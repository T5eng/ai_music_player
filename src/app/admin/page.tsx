import { AdminUploader } from "@/components/AdminUploader";

export const metadata = {
  title: "预置曲目管理 · AI Music",
  description: "上传和管理 AI 音乐播放器预置曲目",
};

export default function AdminPage() {
  return <AdminUploader />;
}
