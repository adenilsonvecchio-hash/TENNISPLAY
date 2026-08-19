/**
 * Instrumentação de Performance para o TennisPlay (Padrão LetsPlay)
 * Mede tempos reais de restauração de sessão, cache e consultas Supabase.
 */

class PerformanceMonitor {
  private enabled = true;

  start(markName: string): void {
    if (!this.enabled || typeof window === 'undefined' || !window.performance?.mark) return;
    try {
      performance.mark(`${markName}_start`);
    } catch {
      // Ignore if marks collide
    }
  }

  end(markName: string, meta?: Record<string, any>): number | null {
    if (!this.enabled || typeof window === 'undefined' || !window.performance?.measure) return null;
    try {
      performance.mark(`${markName}_end`);
      const measureName = `[TennisPlay] ${markName}`;
      const measure = performance.measure(measureName, `${markName}_start`, `${markName}_end`);
      
      const durationMs = Math.round(measure.duration);
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`⏱️ ${measureName}: ${durationMs}ms`, meta || '');
      }

      // Cleanup marks to prevent memory leaks
      performance.clearMarks(`${markName}_start`);
      performance.clearMarks(`${markName}_end`);
      performance.clearMeasures(measureName);

      return durationMs;
    } catch {
      return null;
    }
  }
}

export const perf = new PerformanceMonitor();
