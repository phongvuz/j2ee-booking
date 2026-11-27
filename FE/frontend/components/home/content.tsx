import { FiBookOpen } from "react-icons/fi";
import { FaBuilding, FaMountain } from "react-icons/fa";

export const DESTINATIONS = [
  {
    id: "halong",
    tripDestination: "Hạ Long",
    large: true,
    title: "Vịnh Hạ Long",
    location: "Quảng Ninh",
    duration: "3 ngày",
    imageUrl: "/images/halong.jpg",

  },
  {
    id: "mucangchai",
    tripDestination: "Mù Cang Chải",
    large: false,
    title: "Mù Cang Chải",
    location: "Yên Bái",
    duration: "Mùa lúa chín",
    imageUrl: "/images/mucangchai.jpg",

  },
  {
    id: "phuquoc",
    tripDestination: "Phú Quốc",
    large: false,
    title: "Phú Quốc",
    location: "Kiên Giang",
    duration: "Biển & nghỉ dưỡng",
    imageUrl: "/images/phuquoc.jpg",

  },
];

export const GUIDES = [
  {
    id: "hagiang",
    title: "Hà Giang",
    subtitle: "Road trip 4 ngày",
    imageUrl: "/images/hagiang.jpg",
    link: "/trips?to=" + encodeURIComponent("Hà Giang"),
    iconBg: "bg-brand-light text-brand-primary",
    icon: (
      <FaMountain aria-hidden="true" className="w-4 h-4" />
    ),
  },
  {
    id: "ninhbinh",
    title: "Ninh Bình",
    subtitle: "Đi chậm giữa di sản",
    imageUrl: "/images/ninhbinh.jpg",
    link: "/trips?to=" + encodeURIComponent("Ninh Bình"),
    iconBg: "bg-[#E2F0F3] text-[#0D6D7E]",
    icon: (
      <FaBuilding aria-hidden="true" className="w-4 h-4" />
    ),
  },
  {
    id: "hoian",
    title: "Hội An",
    subtitle: "Ẩm thực & phố cổ",
    imageUrl: "/images/hoian.jpg",
    link: "/trips?to=" + encodeURIComponent("Hội An"),
    iconBg: "bg-[#F7EFE2] text-[#9A641A]",
    icon: (
      <FiBookOpen aria-hidden="true" className="w-4 h-4" />
    ),
  },
];

