import React from 'react';

export function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <p className="text-neutral-600">功能开发中...</p>
    </div>
  );
}
