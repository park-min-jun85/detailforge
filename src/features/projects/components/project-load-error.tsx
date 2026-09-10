export function ProjectLoadError({ message, retryHref }: { message: string; retryHref: string }) {
  return (
    <div role="alert" className="panel space-y-3 p-6">
      <p className="text-sm leading-6 text-red-700">{message}</p>
      {/* 새 서버 조회를 위해 전체 문서를 다시 요청한다. */}
      <a href={retryHref} className="text-link">다시 불러오기</a>
    </div>
  );
}