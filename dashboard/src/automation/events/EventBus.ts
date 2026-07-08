export type EventType =
  | 'LeadCreated'
  | 'ConversationCreated'
  | 'ConversationUpdated'
  | 'MessageReceived'
  | 'MessageSent'
  | 'CampaignStarted'
  | 'CampaignFinished'
  | 'ContentPublished'
  | 'AutomationCompleted'
  | 'ConnectedAccountAdded';

export interface AppEvent<T = any> {
  id: string;
  type: EventType;
  timestamp: Date;
  payload: T;
  workspaceId: string;
}

export type EventSubscriberCallback<T = any> = (event: AppEvent<T>) => Promise<void> | void;

export class EventBus {
  private static instance: EventBus;
  private subscribers: Map<EventType, EventSubscriberCallback[]> = new Map();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public subscribe<T = any>(type: EventType, callback: EventSubscriberCallback<T>): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, []);
    }
    this.subscribers.get(type)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(type) || [];
      this.subscribers.set(type, callbacks.filter(cb => cb !== callback));
    };
  }

  public async publish<T = any>(type: EventType, workspaceId: string, payload: T): Promise<void> {
    const event: AppEvent<T> = {
      id: Math.random().toString(36).substring(7),
      type,
      timestamp: new Date(),
      payload,
      workspaceId
    };

    const callbacks = this.subscribers.get(type) || [];
    const promises = callbacks.map(callback => {
      try {
        const result = callback(event);
        if (result instanceof Promise) {
          return result.catch(err => {
            console.error(`[EventBus] Error in async subscriber callback for event ${type}:`, err);
          });
        }
      } catch (err) {
        console.error(`[EventBus] Error in sync subscriber callback for event ${type}:`, err);
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
  }

  public clearAll(): void {
    this.subscribers.clear();
  }
}
export class LoggerEventSubscriber {
  public static register(eventBus: EventBus) {
    eventBus.subscribe('LeadCreated', (event) => {
      console.log(`[EventBus Log] Event: LeadCreated, Workspace: ${event.workspaceId}, ID: ${event.payload?.id}`);
    });
    eventBus.subscribe('MessageReceived', (event) => {
      console.log(`[EventBus Log] Event: MessageReceived, Msg: ${event.payload?.id}`);
    });
  }
}
export class n8nJobEventSubscriber {
  public static register(eventBus: EventBus) {
    eventBus.subscribe('ConversationCreated', (event) => {
      // Trigger n8n webhook registration stubs
      console.log(`[EventBus n8n] Dispatched ConversationCreated details to n8n intake queue.`);
    });
  }
}
