"use client";
import { useParams } from "next/navigation";
import { EditorWallpaper } from "@/components/editor-wallpaper";

export default function Editar() {
  const { id } = useParams<{ id: string }>();
  return <EditorWallpaper id={id} />;
}
