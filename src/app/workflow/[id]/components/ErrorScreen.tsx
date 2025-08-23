"use client";

import React from "react";
import Link from "next/link";

type ErrorScreenProps = {
  message: string;
};

export default function ErrorScreen({ message }: ErrorScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="text-red-500 mb-4">{message}</div>
      <Link
        href="/"
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
      >
        Back to Home
      </Link>
    </div>
  );
}
