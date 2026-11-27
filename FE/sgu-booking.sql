-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: sgu-booking
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `booking`
--

DROP TABLE IF EXISTS `booking`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `booking` (
  `id` int NOT NULL AUTO_INCREMENT,
  `seatNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CONFIRMED',
  `totalPrice` double NOT NULL,
  `userId` int NOT NULL,
  `tripId` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `pnr` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `passengerName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `passengerPhone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activeSeat` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmedAt` datetime(3) DEFAULT NULL,
  `expiresAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `booking_activeSeat_key` (`activeSeat`),
  KEY `Booking_userId_fkey` (`userId`),
  KEY `Booking_tripId_fkey` (`tripId`),
  KEY `booking_pnr_idx` (`pnr`),
  KEY `booking_status_createdAt_idx` (`status`,`createdAt`),
  KEY `booking_status_confirmedAt_idx` (`status`,`confirmedAt`),
  KEY `booking_status_expiresAt_idx` (`status`,`expiresAt`),
  CONSTRAINT `Booking_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trip` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Booking_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `booking`
--

LOCK TABLES `booking` WRITE;
/*!40000 ALTER TABLE `booking` DISABLE KEYS */;
INSERT INTO `booking` VALUES (5,'A01','CONFIRMED',300000,7,6,'2026-09-21 08:31:45.318','NHAXE-SG-DL-01-75','Nguyễn Văn An','0901234567','6:A01','2026-09-21 08:31:45.318',NULL),(6,'B05','CONFIRMED',350000,8,7,'2026-09-21 08:31:45.322','NHAXE-SG-DL-02-86','Trần Thị Bình','0987654321','7:B05','2026-10-09 09:56:04.938',NULL),(8,'A02','CONFIRMED',300000,9,6,'2026-09-26 17:36:52.975','NHAXE-SG-DL-01-98','Lê Khang Huy','0348582040','6:A02','2026-09-26 17:36:52.975',NULL),(9,'B01','CONFIRMED',300000,9,6,'2026-10-09 08:45:30.474','NHAXE-SG-DL-01-99','Lê Khang Huy','0348582040','6:B01','2026-10-09 08:45:30.474',NULL),(10,'B02','CONFIRMED',300000,9,6,'2026-10-09 08:45:30.489','NHAXE-SG-DL-01-910','Lê Khang Huy','0348582040','6:B02','2026-10-09 08:45:30.489',NULL),(11,'C01','CONFIRMED',300000,9,6,'2026-10-09 08:45:30.492','NHAXE-SG-DL-01-911','Lê Khang Huy','0348582040','6:C01','2026-10-09 08:45:30.492',NULL),(12,'C02','CONFIRMED',300000,9,6,'2026-10-09 08:45:30.495','NHAXE-SG-DL-01-912','Lê Khang Huy','0348582040','6:C02','2026-10-09 08:45:30.495',NULL),(13,'B03','CONFIRMED',300000,9,6,'2026-10-09 08:45:30.498','NHAXE-SG-DL-01-913','Lê Khang Huy','0348582040','6:B03','2026-10-09 08:45:30.498',NULL),(14,'A01','PENDING',300000,9,11,'2026-10-11 18:10:05.455','NHAXE-11-AEFBEA19D9705A90','Lê Khang Huy','0348582040','11:A01',NULL,NULL),(15,'B01','PENDING',300000,9,11,'2026-10-11 18:10:05.459','NHAXE-11-AEFBEA19D9705A90','Lê Khang Huy','0348582040','11:B01',NULL,NULL),(16,'A07','PENDING',300000,9,6,'2026-10-22 14:56:13.157','NHAXE-6-B970709E10793E15','lê khang huy','0348582040','6:A07',NULL,NULL),(17,'B07','PENDING',300000,9,6,'2026-10-22 14:56:13.162','NHAXE-6-B970709E10793E15','lê khang huy','0348582040','6:B07',NULL,NULL),(18,'B10','PENDING',300000,9,6,'2026-10-22 14:56:38.058','NHAXE-6-B2657220C9674201','le khang huy','0348582040','6:B10',NULL,NULL),(19,'A08','PENDING',300000,9,6,'2026-10-22 15:05:04.949','NHAXE-6-4960F04E3BDC9367','Lê Khang Huy','0348582040','6:A08',NULL,NULL),(20,'C07','PENDING',300000,9,6,'2026-10-22 15:05:04.954','NHAXE-6-4960F04E3BDC9367','Lê Khang Huy','0348582040','6:C07',NULL,NULL),(21,'A01','CANCELLED',300000,9,13,'2026-11-05 18:06:09.966','NHAXE-13-465E53E1BC48D4D5','Lê Khang Huy','0348582040',NULL,NULL,NULL),(22,'A01','PENDING',300000,13,13,'2026-11-05 18:11:15.091','NHAXE-13-B7285CED9DBEAC53','Lê Khang Huy','0348582040','13:A01',NULL,NULL),(23,'B01','CANCELLED',300000,14,13,'2026-11-05 18:44:03.391','NHAXE-13-30B728D85772BB1D','Lê Khang Huy','0348582040',NULL,NULL,'2026-11-05 18:49:03.377'),(24,'C01','CANCELLED',300000,15,13,'2026-11-05 19:02:03.597','NHAXE-13-14DB34D87B859A0B','Lê Khang Huy','0348582040',NULL,NULL,'2026-11-05 19:07:03.583'),(25,'A02','CANCELLED',300000,16,13,'2026-11-05 19:03:33.630','NHAXE-13-DFAB94B6A3355CF0','Lê Khang Huy','0348582040',NULL,NULL,'2026-11-05 19:08:33.619'),(26,'A02','CANCELLED',300000,17,13,'2026-11-05 19:13:22.742','NHAXE-13-4752C4A5B04EA165','Lê Khang Huy','0348582040',NULL,NULL,'2026-11-05 19:18:22.731'),(27,'A01','CANCELLED',300000,18,14,'2026-11-05 19:28:21.928','NHAXE-14-73EE08C9443BF31B','Lê Khang Huy','0348582040',NULL,NULL,'2026-11-05 19:33:21.915'),(28,'A01','CANCELLED',300000,19,14,'2026-11-05 19:34:53.381','NHAXE-14-1644F2DC230AA165','Lê Khang Huy','0348582040',NULL,NULL,'2026-11-05 19:39:53.372'),(29,'A01','CONFIRMED',300000,20,14,'2026-11-05 20:15:31.687','NHAXE-14-15F21C1EFCDD9C6A','Lê Khang Huy','0348582040','14:A01','2026-11-05 20:15:49.582','2026-11-05 20:20:31.670');
/*!40000 ALTER TABLE `booking` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bus`
--

DROP TABLE IF EXISTS `bus`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bus` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plate` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `capacity` int NOT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Đang hoạt động',
  `brand` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `year` int DEFAULT NULL,
  `driverName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driverPhone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastMaintenance` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `bus_plate_key` (`plate`),
  CONSTRAINT `bus_capacity_check` CHECK ((`capacity` between 1 and 60))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bus`
--

LOCK TABLES `bus` WRITE;
/*!40000 ALTER TABLE `bus` DISABLE KEYS */;
INSERT INTO `bus` VALUES ('SAMPLE-TRIP-10','50F-90010','Giường nằm',34,'Đang hoạt động',NULL,NULL,NULL,NULL,NULL,'Xe mẫu được tạo theo yêu cầu cho chuyến 10, giữ nguyên sức chứa 34 ghế. Biển số là dữ liệu minh họa; cần xác minh trước khi sử dụng thực tế.','2026-11-07 03:43:57.532'),('SAMPLE-TRIP-11','50F-90011','Xe ghế ngồi',28,'Đang hoạt động',NULL,NULL,NULL,NULL,NULL,'Xe mẫu được tạo theo yêu cầu cho chuyến 11, giữ nguyên sức chứa 28 ghế. Biển số là dữ liệu minh họa; cần xác minh trước khi sử dụng thực tế.','2026-11-07 03:43:57.533'),('SAMPLE-TRIP-13','50F-90013','Xe ghế ngồi',30,'Đang hoạt động',NULL,NULL,NULL,NULL,NULL,'Xe mẫu được tạo theo yêu cầu cho chuyến 13, giữ nguyên sức chứa 30 ghế. Biển số là dữ liệu minh họa; cần xác minh trước khi sử dụng thực tế.','2026-11-07 03:43:57.534'),('SAMPLE-TRIP-14','50F-90014','Xe ghế ngồi',3,'Đang hoạt động',NULL,NULL,NULL,NULL,NULL,'Xe mẫu được tạo theo yêu cầu cho chuyến 14, giữ nguyên sức chứa 3 ghế. Biển số là dữ liệu minh họa; cần xác minh trước khi sử dụng thực tế.','2026-11-07 03:43:57.535'),('SAMPLE-TRIP-6','50F-90006','Giường nằm',34,'Đang hoạt động',NULL,NULL,NULL,NULL,NULL,'Xe mẫu được tạo theo yêu cầu cho chuyến 6, giữ nguyên sức chứa 34 ghế. Biển số là dữ liệu minh họa; cần xác minh trước khi sử dụng thực tế.','2026-11-07 03:43:57.525'),('SAMPLE-TRIP-7','50F-90007','Xe ghế ngồi',23,'Đang hoạt động',NULL,NULL,NULL,NULL,NULL,'Xe mẫu được tạo theo yêu cầu cho chuyến 7, giữ nguyên sức chứa 23 ghế. Biển số là dữ liệu minh họa; cần xác minh trước khi sử dụng thực tế.','2026-11-07 03:43:57.528'),('SAMPLE-TRIP-8','50F-90008','Xe ghế ngồi',30,'Đang hoạt động',NULL,NULL,NULL,NULL,NULL,'Xe mẫu được tạo theo yêu cầu cho chuyến 8, giữ nguyên sức chứa 30 ghế. Biển số là dữ liệu minh họa; cần xác minh trước khi sử dụng thực tế.','2026-11-07 03:43:57.530'),('SAMPLE-TRIP-9','50F-90009','Xe ghế ngồi',26,'Đang hoạt động',NULL,NULL,NULL,NULL,NULL,'Xe mẫu được tạo theo yêu cầu cho chuyến 9, giữ nguyên sức chứa 26 ghế. Biển số là dữ liệu minh họa; cần xác minh trước khi sử dụng thực tế.','2026-11-07 03:43:57.531');
/*!40000 ALTER TABLE `bus` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer`
--

DROP TABLE IF EXISTS `customer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Đang hoạt động',
  `address` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_email_key` (`email`),
  UNIQUE KEY `customer_phone_key` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer`
--

LOCK TABLES `customer` WRITE;
/*!40000 ALTER TABLE `customer` DISABLE KEYS */;
INSERT INTO `customer` VALUES ('CUS-001','Nguyễn Minh Tuấn','tuannguyen@gmail.com','0903456789','Đang hoạt động','Quận 10, TP. Hồ Chí Minh','2026-09-26 08:05:48.455'),('CUS-002','Trần Ngọc Mai','maitran@gmail.com','0914567890','Đang hoạt động','Quận Bình Thạnh, TP. Hồ Chí Minh','2026-09-26 08:05:48.455'),('CUS-003','Lê Hoàng Nam','namle@gmail.com','0935678901','Ngừng hoạt động','TP. Thủ Đức, TP. Hồ Chí Minh','2026-09-26 08:05:48.455'),('CUS-004','Lê Khang Huy','lekhanghuy762@gmail.com','0348582040','Đang hoạt động','254/40 Thái Phiên','2026-09-26 09:31:09.110'),('CUS-005','lê văn si','abc@gmail.com','0897567865','Ngừng hoạt động','234 lý thường kiệt','2026-09-26 09:44:50.238'),('CUS-006','nguyễn văn huy','lhk@gmail.com','0987654123','Đang hoạt động','297 Lý Thường Kiệt','2026-10-05 10:40:09.080');
/*!40000 ALTER TABLE `customer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee`
--

DROP TABLE IF EXISTS `employee`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `department` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Đang làm việc',
  `avatar` text COLLATE utf8mb4_unicode_ci,
  `identityCard` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `startDate` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_email_key` (`email`),
  UNIQUE KEY `employee_phone_key` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee`
--

LOCK TABLES `employee` WRITE;
/*!40000 ALTER TABLE `employee` DISABLE KEYS */;
INSERT INTO `employee` VALUES ('EMP-001','Nguyễn Văn A','nguyenvana@nhaxe.vn','0901234567','Tài xế','Đội xe','Đang làm việc','https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80','079201001234','Quận 1, TP. Hồ Chí Minh','2023-01-15','2026-09-26 01:05:38.390'),('EMP-002','Trần Thị B','tranthib@nhaxe.vn','0912345678','Văn phòng','Phòng vé','Đang làm việc','https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80','079202002345','Quận 5, TP. Hồ Chí Minh','2023-03-20','2026-09-26 01:05:38.394'),('EMP-003','Lê Hoàng C','lehoangc@nhaxe.vn','0923456789','Phụ xe','Đội xe','Nghỉ phép','https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80','079203003456','TP. Thủ Đức, TP. Hồ Chí Minh','2023-06-10','2026-09-26 01:05:38.398'),('EMP-004','Phạm Văn D','phamvand@nhaxe.vn','0934567890','Tài xế','Đội xe','Đang làm việc','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80','079204004567','Quận Bình Thạnh, TP. Hồ Chí Minh','2023-09-01','2026-09-26 01:05:38.401'),('EMP-005','Hoàng Thị E','hoangthie@nhaxe.vn','0945678901','Quản lý','Ban điều hành','Đang làm việc','https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80','079205005678','Quận 3, TP. Hồ Chí Minh','2022-11-15','2026-09-26 01:05:38.404'),('EMP-006','Vũ Minh Tuấn','tuanvm@nhaxe.vn','0967890123','Tài xế','Đội xe','Đang làm việc','https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80','079206006789','Quận 10, TP. Hồ Chí Minh','2024-01-08','2026-09-26 01:05:38.409'),('EMP-007','Đặng Thu Thảo','thaodt@nhaxe.vn','0978901234','Văn phòng','Kế toán','Đang làm việc','https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80','079207007890','Quận Phú Nhuận, TP. Hồ Chí Minh','2024-02-14','2026-09-26 01:05:38.411'),('EMP-008','Bùi Quốc Hưng','hungbq@nhaxe.vn','0989012345','Điều hành','Ban điều hành','Đang làm việc','https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80','079208008901','Quận Gò Vấp, TP. Hồ Chí Minh','2024-03-01','2026-09-26 01:05:38.415'),('EMP-009','Ngô Thanh Hằng','hangnt@nhaxe.vn','0918765432','Văn phòng','Phòng vé','Đã nghỉ việc','https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80','079209009012','Quận Tân Bình, TP. Hồ Chí Minh','2023-04-12','2026-09-26 01:05:38.418'),('EMP-010','Đinh Công Trình','trinhdc@nhaxe.vn','0932145678','Tài xế','Đội xe','Đang làm việc','https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80','079210001023','Quận 12, TP. Hồ Chí Minh','2024-05-20','2026-09-26 01:05:38.421'),('EMP-011','Lý Hải Đăng','danglh@nhaxe.vn','0943215678','Phụ xe','Đội xe','Đang làm việc','https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80','079211002134','Huyện Hóc Môn, TP. Hồ Chí Minh','2024-06-01','2026-09-26 01:05:38.425'),('EMP-012','Phan Kim Oanh','oanhpk@nhaxe.vn','0954321678','Văn phòng','Kế toán','Nghỉ phép','https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80','079212003245','Quận 7, TP. Hồ Chí Minh','2024-06-15','2026-09-26 01:05:38.428'),('EMP-013','Lê Khang Huy','lekhanghuy@nhaxe.vn','0358160688','Quản lý','Quản lý','Đang làm việc','https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80','060208067965','Quận 11, TP. Hồ Chí Minh','2026-01-15','2026-09-30 15:43:59.118');
/*!40000 ALTER TABLE `employee` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment`
--

DROP TABLE IF EXISTS `payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment` (
  `id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pnr` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` int NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `checkoutUrl` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `providerTransactionId` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responseCode` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` datetime(3) NOT NULL,
  `paidAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Payment_providerTransactionId_key` (`providerTransactionId`),
  KEY `Payment_pnr_createdAt_idx` (`pnr`,`createdAt`),
  KEY `Payment_status_createdAt_idx` (`status`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment`
--

LOCK TABLES `payment` WRITE;
/*!40000 ALTER TABLE `payment` DISABLE KEYS */;
INSERT INTO `payment` VALUES ('538fd8f26b365936b4f9d60c074e86ba','NHAXE-14-15F21C1EFCDD9C6A',300000,'SUCCESS','https://img.vietqr.io/image/970436-123456789-compact2.png?amount=300000&addInfo=VE29&accountName=NOMAD','DEMO-538fd8f26b365936b4f9d60c074e86ba','DEMO','2026-11-05 20:15:49.582','2026-11-17 01:00:00.000','2026-11-05 20:15:49.582');
/*!40000 ALTER TABLE `payment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `seathold`
--

DROP TABLE IF EXISTS `seathold`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `seathold` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tripId` int NOT NULL,
  `seatNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clientId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `SeatHold_tripId_seatNumber_key` (`tripId`,`seatNumber`)
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `seathold`
--

LOCK TABLES `seathold` WRITE;
/*!40000 ALTER TABLE `seathold` DISABLE KEYS */;
INSERT INTO `seathold` VALUES (67,10,'C01','lz2bo01lcyp','2026-10-01 13:24:57.960','2026-10-01 13:19:57.965'),(69,10,'C03','lz2bo01lcyp','2026-10-01 13:25:08.259','2026-10-01 13:20:08.265');
/*!40000 ALTER TABLE `seathold` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trip`
--

DROP TABLE IF EXISTS `trip`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trip` (
  `id` int NOT NULL AUTO_INCREMENT,
  `from` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `to` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `time` datetime(3) NOT NULL,
  `price` double NOT NULL,
  `availableSeats` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `busId` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `trip_time_idx` (`time`),
  KEY `trip_busId_idx` (`busId`),
  CONSTRAINT `trip_busId_fkey` FOREIGN KEY (`busId`) REFERENCES `bus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `trip_seat_counts_check` CHECK ((`availableSeats` between 0 and 60))
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trip`
--

LOCK TABLES `trip` WRITE;
/*!40000 ALTER TABLE `trip` DISABLE KEYS */;
INSERT INTO `trip` VALUES (6,'Hồ Chí Minh','Đà Lạt','2026-10-27 00:00:00.000',300000,22,'2026-09-21 08:31:45.298','SAMPLE-TRIP-6'),(7,'Hồ Chí Minh','Đà Lạt','2026-10-01 23:00:00.000',350000,22,'2026-09-21 08:31:45.302','SAMPLE-TRIP-7'),(8,'Hồ Chí Minh','Nha Trang','2026-10-01 22:30:00.000',280000,30,'2026-09-21 08:31:45.305','SAMPLE-TRIP-8'),(9,'Hồ Chí Minh','Vũng Tàu','2026-10-01 07:30:00.000',160000,26,'2026-09-21 08:31:45.308','SAMPLE-TRIP-9'),(10,'Hồ Chí Minh','Hà Nội','2026-10-01 08:00:00.000',900000,34,'2026-09-21 08:31:45.312','SAMPLE-TRIP-10'),(11,'Đà Lạt','Hồ Chí Minh','2026-10-17 00:00:00.000',300000,26,'2026-09-21 08:31:45.315','SAMPLE-TRIP-11'),(13,'Hồ Chí Minh','Đà Lạt','2026-11-16 01:00:00.000',300000,29,'2026-11-05 18:04:47.501','SAMPLE-TRIP-13'),(14,'Hồ Chí Minh','Đà Nẵng','2026-11-17 01:00:00.000',300000,2,'2026-11-05 19:27:57.347','SAMPLE-TRIP-14');
/*!40000 ALTER TABLE `trip` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fullName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_phone_key` (`phone`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES (7,'Nguyễn Văn An','0901234567','password123','USER','2026-09-21 08:31:45.290',1),(8,'Trần Thị Bình','0987654321','scrypt:3b1eee0ac382dc97bbb518c7f24c44d7:ec38da25cc135951e932671bfba9ed956cb277617451b0d5845fa69bb5a9e723f5327d1a24857dacc7c2cc050917b00c3ed47cfe0e860edd0c1de052fb9556ca','ADMIN','2026-09-21 08:31:45.294',1),(9,'Lê Khang Huy','0348582040','scrypt:543afbd1456767cca72a276a76d6e10a:bb319e7f2211c59e91319affc01dd7a94a7c950cc3d86200c03af509082b84a4d33a45d615a3e24e13bb0f85ebd624af7529680ee6b3ee3d48f60d18428d0346','CUSTOMER','2026-09-26 09:31:09.098',1),(10,'lê văn si','0897567865','scrypt:0a3036cfae014746c8c95bc58f368c45:171ade64e45b4dbae231d5ead767d8794f62a63118c9d7f9d3fde7a3cccdc207547ceee2b40cf1c06e19b4f608fad25a2c67b612f35e06baf5758d36f6dce439','CUSTOMER','2026-09-26 09:44:50.229',1),(11,'Lê Khang Huy','0358160688','scrypt:4573c290fb70b3f3ff9b770d72b5193c:fb2c742986ea82999f29dbc5ebb3348ff741c66c89a538969c444721d6feb02dbe04f01734a2bc729a3e1feedb30bbe0cd54f469957bc664c82eaf11151a5535','ADMIN','2026-09-30 15:46:54.123',1),(12,'nguyễn văn huy','0987654123','scrypt:e83b9768f0a876e7ecbd065f8c8a47ba:abc3d226ed16df538abbfca29ed118ae197a7ec5a1a7bea2a198423374fcef90d495e7964bef7bd9a9a1a4f25fec1054068de7054de5f746feff84f6509b4d5e','CUSTOMER','2026-10-05 10:40:09.072',1),(13,'Lê Khang Huy','guest:48c4b38ea1e9bb9365dcf4a505097f7d','scrypt:ddfbdfcb977467bbf42c8452dc9d148e:5ecf109f335bcf844e765a9dc2a46a63b926ac356212385ec439c0314feab8914f944d42b2256e9ca1a7a92cfa86d7300e1280e4c8020a62bce07b01bdf5087c','USER','2026-11-05 18:11:15.087',1),(14,'Lê Khang Huy','guest:897768744365dc28a3d861b055e1dd2e','scrypt:fda18492d505d5b61c5e91c2922f4967:b0c042b3691f36386ce77206f7a8f0adc7966056efb601c846ab90c95543e38f7bfb10f576bd8bd7cf43ad4fc24b5f3c603b213262a4ef602b5f749570992d92','USER','2026-11-05 18:44:03.386',1),(15,'Lê Khang Huy','guest:88656bcc90c966c4b5ea6a19e70a8cef','scrypt:c167ba80fdcecb260de6f9733ee59741:03a61fe19f879b8145b5c62ac2071455f5b9f5deb1f9c261fbb54f74eb0089d4d740539f8cda05a55587844997bada2d53bf9f1ddd402d08c6c5f91d9844bf21','USER','2026-11-05 19:02:03.594',1),(16,'Lê Khang Huy','guest:8533189430b61427b7945a3fac47021f','scrypt:039f1ebd6e6510cf2f60bce75896891c:0d16aebb7c4e629434b738a2a3012de2361356d5b5551aa693cc8d6f18fe1928abe108e6b44c3528553984dceff0716c896183921e3994487935310e1728d252','USER','2026-11-05 19:03:33.627',1),(17,'Lê Khang Huy','guest:636a6206e55b95b8d269b35b56719775','scrypt:208737a9387dc96299d5f7569cdbf1ea:474950d827a9bf13e3978f71030720e1a07834c45208bfed6e0588647e9a5e25229a24829b34ff8ecd15712a7ce0ded7c99a5741ed200c2205f4b600a89e96fa','USER','2026-11-05 19:13:22.739',1),(18,'Lê Khang Huy','guest:9344c1c7387bbb39fba4da7edfab03ed','scrypt:71fa270a4e70509ad656bd07476ea938:d71eaada9b9f758b87d22891049b40946c032e58e5a8069eb1ca84ed193387f9d59fa3200459d2faa226b779ed4b6dbc6b8e731692453baf7c970b669a8d33bb','USER','2026-11-05 19:28:21.925',1),(19,'Lê Khang Huy','guest:d0e364c40f926a9e3aa8f0556ebac3b7','scrypt:83d0556e2607c685531bc2c7b9f02c53:0741e9214eb8bb58537cca23bc8c3419c622fd157eefed7b78158e6d90c51956b9d4e44983cad3610732633e4c7b1bc5f3f2cb1d61c2cd8a7f3fce8d020873f6','USER','2026-11-05 19:34:53.379',1),(20,'Lê Khang Huy','guest:44441be873edaceddc2c470903d16694','scrypt:209e53e4bc52b14e9c1cfb97a21c1940:e85ec9c6de1c40160e123f0a8b41e592ad2b04791de6b2c83a0813423db39a53c2606a8dc67764ba61db2b887cbad0c5479654ec237d37acdd3d7427a3bd00c4','USER','2026-11-05 20:15:31.682',1);
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'sgu-booking'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-07  3:45:20
