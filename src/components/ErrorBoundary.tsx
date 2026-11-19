import { Component, ErrorInfo, ReactNode } from 'react';
import { gameDiagnostics } from '../game/diagnostics';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Непредвиденная ошибка интерфейса',
    };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    gameDiagnostics.recordError('ErrorBoundary', error, 'fatal');
    console.error('Game ErrorBoundary caught:', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  private handleReload = () => {
    window.location.reload();
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="w-screen h-screen bg-[#06080d] text-[#d8dee4] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0b1019] border border-[#2a3346] p-6 shadow-2xl space-y-4">
          <div className="font-display text-2xl text-[#e28c8c] tracking-wide">
            Сбой в системе дома
          </div>
          <p className="text-sm text-[#a6b2c6] leading-relaxed">
            Во время работы интерфейса произошла ошибка. Ваш прогресс в сохранённой записи не затронут.
          </p>
          {this.state.message && (
            <div className="bg-[#070a10] border border-[#1f2737] px-3 py-2 text-xs font-mono-ui text-[#7c899e] break-words">
              {this.state.message}
            </div>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 bg-[#161f30] hover:bg-[#1f2c42] border border-[#3a4b6b] text-sm font-medium text-[#e4ecf5] transition cursor-pointer"
            >
              Попробовать продолжить
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 bg-[#101520] hover:bg-[#182030] border border-[#2b3549] text-sm text-[#b4c0d4] transition cursor-pointer"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      </div>
    );
  }
}
