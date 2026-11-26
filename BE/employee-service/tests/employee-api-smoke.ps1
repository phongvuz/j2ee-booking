# Requires PowerShell 7 and a local Employee Service using a disposable database.
param([uri]$BaseUrl = 'http://127.0.0.1:8080')

$ErrorActionPreference = 'Stop'
if (!$BaseUrl.IsLoopback) { throw 'The smoke test requires a local Employee Service.' }
if (!$env:EMPLOYEE_TEST_ADMIN_TOKEN -or !$env:EMPLOYEE_TEST_STAFF_TOKEN -or !$env:EMPLOYEE_TEST_CLIENT_TOKEN) {
    throw 'Set EMPLOYEE_TEST_ADMIN_TOKEN, EMPLOYEE_TEST_STAFF_TOKEN and EMPLOYEE_TEST_CLIENT_TOKEN.'
}
$employeesUrl = [uri]::new($BaseUrl, '/employees')

function Invoke-EmployeeApi {
    param(
        [string]$Method, [uri]$Url, [int]$ExpectedStatus, [hashtable]$Payload,
        [string]$Token = $env:EMPLOYEE_TEST_ADMIN_TOKEN
    )

    $request = @{ Method = $Method; Uri = $Url; SkipHttpErrorCheck = $true; TimeoutSec = 10 }
    if ($Token) { $request.Headers = @{ Authorization = "Bearer $Token" } }
    if ($null -ne $Payload) {
        $request.ContentType = 'application/json; charset=utf-8'
        $request.Body = ConvertTo-Json -InputObject $Payload -Compress
    }
    $response = Invoke-WebRequest @request
    $content = $response.Content
    if ($content -is [byte[]]) { $content = [Text.Encoding]::UTF8.GetString($content) }
    if ($response.StatusCode -ne $ExpectedStatus) {
        throw "$Method $Url returned $($response.StatusCode), expected $ExpectedStatus. $content"
    }
    if ($content.Length -gt 0) { ConvertFrom-Json -InputObject $content -NoEnumerate }
}

$protectedEndpoints = @(
    @{ Method = 'GET'; Url = $employeesUrl }
    @{ Method = 'POST'; Url = $employeesUrl }
    @{ Method = 'PUT'; Url = [uri]::new($BaseUrl, '/employees/1') }
    @{ Method = 'DELETE'; Url = [uri]::new($BaseUrl, '/employees/1') }
    @{ Method = 'PATCH'; Url = [uri]::new($BaseUrl, '/employees/1/status') }
    @{ Method = 'GET'; Url = [uri]::new($BaseUrl, '/employees/1/driver-eligibility') }
)
foreach ($endpoint in $protectedEndpoints) {
    Invoke-EmployeeApi @endpoint -ExpectedStatus 401 -Token '' | Out-Null
    Invoke-EmployeeApi @endpoint -ExpectedStatus 403 -Token $env:EMPLOYEE_TEST_STAFF_TOKEN | Out-Null
    Invoke-EmployeeApi @endpoint -ExpectedStatus 403 -Token $env:EMPLOYEE_TEST_CLIENT_TOKEN | Out-Null
}

$tokenParts = $env:EMPLOYEE_TEST_ADMIN_TOKEN.Split('.')
if ($tokenParts.Count -ne 3 -or !$tokenParts[2]) { throw 'The ADMIN test token must be a signed JWT.' }
$signatureStart = if ($tokenParts[2].StartsWith('A')) { 'B' } else { 'A' }
$tokenParts[2] = $signatureStart + $tokenParts[2].Substring(1)
Invoke-EmployeeApi GET $employeesUrl 401 -Token ($tokenParts -join '.') | Out-Null

$suffix = [guid]::NewGuid().ToString('N').Substring(0, 12)
$employee = @{
    msnv = "NV$suffix"
    name = 'Smoke Test'
    role = 'Driver'
    phone = '919' + [Convert]::ToInt64($suffix, 16)
}

$invalid = $employee.Clone()
$invalid.name = '   '
$problem = Invoke-EmployeeApi POST $employeesUrl 400 $invalid
if ($problem.detail -notlike 'name *') { throw 'Validation error did not identify name.' }
$invalid = $employee.Clone()
$invalid.phone = '9' * 21
Invoke-EmployeeApi POST $employeesUrl 400 $invalid | Out-Null
$invalid = $employee.Clone()
$invalid.Remove('msnv')
$problem = Invoke-EmployeeApi POST $employeesUrl 400 $invalid
if ($problem.detail -notlike 'msnv *') { throw 'Validation error did not identify missing msnv.' }

$created = Invoke-EmployeeApi POST $employeesUrl 201 $employee
if (!$created.id -or $created.status -ne 'WORKING') { throw 'New employee must have an ID and WORKING status.' }
if ($created.msnv -ne $employee.msnv) { throw 'Create response must return msnv.' }

$duplicate = $employee.Clone()
$duplicate.phone = '918' + [Convert]::ToInt64($suffix, 16)
Invoke-EmployeeApi POST $employeesUrl 409 $duplicate | Out-Null
$duplicate = $employee.Clone()
$duplicate.msnv = "ALT$suffix"
Invoke-EmployeeApi POST $employeesUrl 409 $duplicate | Out-Null

$employeeUrl = [uri]::new($BaseUrl, "/employees/$($created.id)")
$statusUrl = [uri]::new($BaseUrl, "/employees/$($created.id)/status")
$eligibilityUrl = [uri]::new($BaseUrl, "/employees/$($created.id)/driver-eligibility")
if (!(Invoke-EmployeeApi GET $eligibilityUrl 200).eligible) { throw 'Working driver must be eligible.' }
Invoke-EmployeeApi PATCH $statusUrl 400 @{ status = 'RESIGNED' } | Out-Null
Invoke-EmployeeApi PATCH $statusUrl 400 @{ status = 0 } | Out-Null
$onLeave = Invoke-EmployeeApi PATCH $statusUrl 200 @{ status = 'ON_LEAVE' }
if ($onLeave.status -ne 'ON_LEAVE' -or (Invoke-EmployeeApi GET $eligibilityUrl 200).eligible) {
    throw 'Driver on leave must be ineligible.'
}
Invoke-EmployeeApi PATCH $statusUrl 200 @{ status = 'WORKING' } | Out-Null
if (!(Invoke-EmployeeApi GET $eligibilityUrl 200).eligible) { throw 'Returning driver must be eligible.' }

$employee.msnv = "NVU$suffix"
$employee.name = 'Updated Smoke Test'
$employee.role = 'Office'
$updated = Invoke-EmployeeApi PUT $employeeUrl 200 $employee
if ($updated.name -ne $employee.name -or $updated.status -ne 'WORKING') { throw 'Profile update failed.' }
if ($updated.msnv -ne $employee.msnv) { throw 'Update response must return the new msnv.' }
if ((Invoke-EmployeeApi GET $eligibilityUrl 200).eligible) { throw 'Non-driver must be ineligible.' }

$missingUrl = [uri]::new($BaseUrl, "/employees/$([long]::MaxValue)")
Invoke-EmployeeApi PUT $missingUrl 404 $employee | Out-Null
Invoke-EmployeeApi DELETE $missingUrl 404 | Out-Null
Invoke-EmployeeApi GET ([uri]::new($BaseUrl, "$missingUrl/driver-eligibility")) 404 | Out-Null
Invoke-EmployeeApi PATCH ([uri]::new($BaseUrl, "$missingUrl/status")) 404 @{ status = 'WORKING' } | Out-Null
Invoke-EmployeeApi DELETE $employeeUrl 204
Invoke-EmployeeApi DELETE $employeeUrl 204

$employee.role = 'Driver'
$updated = Invoke-EmployeeApi PUT $employeeUrl 200 $employee
if ($updated.status -ne 'RESIGNED') { throw 'Editing a resigned employee changed their status.' }
if ((Invoke-EmployeeApi GET $eligibilityUrl 200).eligible) { throw 'Resigned driver must be ineligible.' }
Invoke-EmployeeApi PATCH $statusUrl 409 @{ status = 'WORKING' } | Out-Null
$employees = Invoke-EmployeeApi GET $employeesUrl 200
$saved = $employees | Where-Object id -EQ $created.id
if ($saved.status -ne 'RESIGNED' -or $saved.name -ne $employee.name) { throw 'Resigned employee was not retained.' }
if ($saved.msnv -ne $employee.msnv) { throw 'List response must return the saved msnv.' }

Write-Output 'Employee API smoke test passed.'
