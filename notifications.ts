export type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Notification {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  message: string;
  priority: NotificationPriority;
  scheduledAt?: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed';
}

export interface NotificationService {
  send: (notification: Omit<Notification, 'id' | 'status' | 'sentAt'>) => Promise<Notification>;
  schedule: (notification: Omit<Notification, 'id' | 'status' | 'sentAt'>, sendAt: Date) => Promise<Notification>;
  getStatus: (id: string) => Promise<Notification | undefined>;
  retry: (id: string) => Promise<Notification>;
}

export const createNotificationService = (): NotificationService => {
  const notifications: Map<string, Notification> = new Map();
  let idCounter: number = 1;

  const generateId = (): string => {
    return `notif_${Date.now()}_${idCounter++}`;
  };

  return {
    send: async (
      notification: Omit<Notification, 'id' | 'status' | 'sentAt'>
    ): Promise<Notification> => {
      const id: string = generateId();
      const newNotification: Notification = {
        ...notification,
        id,
        status: 'pending',
      };

      notifications.set(id, newNotification);

      // Simulate sending
      try {
        // In real implementation, call actual notification services
        const sentNotification: Notification = {
          ...newNotification,
          status: 'sent',
          sentAt: new Date(),
        };
        notifications.set(id, sentNotification);
        return sentNotification;
      } catch (error) {
        const failedNotification: Notification = {
          ...newNotification,
          status: 'failed',
        };
        notifications.set(id, failedNotification);
        throw error;
      }
    },

    schedule: async (
      notification: Omit<Notification, 'id' | 'status' | 'sentAt'>,
      sendAt: Date
    ): Promise<Notification> => {
      const id: string = generateId();
      const scheduledNotification: Notification = {
        ...notification,
        id,
        status: 'pending',
        scheduledAt: sendAt,
      };

      notifications.set(id, scheduledNotification);
      return scheduledNotification;
    },

    getStatus: async (id: string): Promise<Notification | undefined> => {
      return notifications.get(id);
    },

    retry: async (id: string): Promise<Notification> => {
      const notification: Notification | undefined = notifications.get(id);
      if (notification === undefined) {
        throw new Error(`Notification ${id} not found`);
      }
      if (notification.status !== 'failed') {
        throw new Error(`Cannot retry notification with status ${notification.status}`);
      }

      const retriedNotification: Notification = {
        ...notification,
        status: 'sent',
        sentAt: new Date(),
      };
      notifications.set(id, retriedNotification);
      return retriedNotification;
    },
  };
};
