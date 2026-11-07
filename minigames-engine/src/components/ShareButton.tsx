import { useState } from 'react';

interface ShareButtonProps {
  title: string;
  score: number;
  /** 결과 한 줄(예: "완벽한 버블티!"). 카드와 공유 문구에 함께 넣는다 */
  headline?: string;
}

/** 공유 이미지를 Canvas로 직접 그린다. html2canvas(약 45KB gzip)를 쓰지 않아 번들이 가볍다. */
function renderCard({ title, score, headline }: ShareButtonProps): Promise<Blob> {
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas를 사용할 수 없습니다.'));

  ctx.fillStyle = '#1f1b16';
  ctx.fillRect(0, 0, size, size);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5efe6';
  ctx.font = '700 72px system-ui, sans-serif';
  ctx.fillText(title, size / 2, 380);
  ctx.fillStyle = '#ffb454';
  ctx.font = '800 220px system-ui, sans-serif';
  ctx.fillText(String(score), size / 2, 640);
  ctx.fillStyle = '#f5efe6';
  ctx.font = '500 56px system-ui, sans-serif';
  ctx.fillText('점', size / 2, 740);
  if (headline) {
    ctx.fillStyle = '#ffb454';
    ctx.font = '700 64px system-ui, sans-serif';
    ctx.fillText(headline, size / 2, 880);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('이미지 생성 실패'))),
      'image/png',
    );
  });
}

export function ShareButton({ title, score, headline }: ShareButtonProps) {
  const [failed, setFailed] = useState(false);

  const share = async () => {
    setFailed(false);
    try {
      const blob = await renderCard({ title, score, headline });
      const file = new File([blob], `${title}-${score}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: headline ? `${title} ${score}점! ${headline}` : `${title} ${score}점!`,
          url: location.href,
        });
        return;
      }
      // 파일 공유를 지원하지 않으면(주로 데스크톱) 이미지를 내려받는다.
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('[engine] 공유 실패', error);
        setFailed(true);
      }
    }
  };

  return (
    <>
      <button type="button" className="mg-button mg-button-secondary" onClick={() => void share()}>
        점수 공유
      </button>
      {failed && (
        <p className="mg-muted" role="alert">
          공유하지 못했어요. 다시 시도해 주세요.
        </p>
      )}
    </>
  );
}
