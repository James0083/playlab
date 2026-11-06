import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * 게임 화면에서 예상치 못한 오류가 나도 흰 화면 대신 안내와 재시작 버튼을 보여준다.
 * React는 오류 경계를 클래스 컴포넌트로만 지원한다.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[engine] 게임 화면 오류', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="mg-result" role="alert">
        <p className="mg-muted">문제가 생겨 게임을 계속할 수 없어요.</p>
        <button type="button" className="mg-button" onClick={() => location.reload()}>
          처음부터 다시 하기
        </button>
      </div>
    );
  }
}
