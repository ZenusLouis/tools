"use client";

import { useEffect } from "react";

export function PageDocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} | GCS Console`;
  }, [title]);

  return null;
}
