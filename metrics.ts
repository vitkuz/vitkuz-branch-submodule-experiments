export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
}

export interface MetricsCollector {
  incrementCounter: (name: string, labels?: Record<string, string>) => void;
  setGauge: (name: string, value: number, labels?: Record<string, string>) => void;
  recordHistogram: (name: string, value: number, labels?: Record<string, string>) => void;
  getMetrics: () => Metric[];
  reset: () => void;
}

export const createMetricsCollector = (): MetricsCollector => {
  const metrics: Map<string, Metric> = new Map();

  const createKey = (name: string, labels: Record<string, string> = {}): string => {
    const labelStr: string = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  };

  return {
    incrementCounter: (name: string, labels: Record<string, string> = {}): void => {
      const key: string = createKey(name, labels);
      const existing: Metric | undefined = metrics.get(key);
      const metric: Metric = {
        name,
        type: 'counter',
        value: existing ? existing.value + 1 : 1,
        timestamp: new Date(),
        labels,
      };
      metrics.set(key, metric);
    },

    setGauge: (name: string, value: number, labels: Record<string, string> = {}): void => {
      const key: string = createKey(name, labels);
      const metric: Metric = {
        name,
        type: 'gauge',
        value,
        timestamp: new Date(),
        labels,
      };
      metrics.set(key, metric);
    },

    recordHistogram: (name: string, value: number, labels: Record<string, string> = {}): void => {
      const key: string = createKey(name, labels);
      const metric: Metric = {
        name,
        type: 'histogram',
        value,
        timestamp: new Date(),
        labels,
      };
      metrics.set(key, metric);
    },

    getMetrics: (): Metric[] => {
      return Array.from(metrics.values());
    },

    reset: (): void => {
      metrics.clear();
    },
  };
};
