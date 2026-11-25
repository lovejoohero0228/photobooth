import { notFound } from "next/navigation";

// 개발용 실험실 페이지는 배포본에서 숨김
export default function LabLayout({ children }: LayoutProps<"/lab">) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
