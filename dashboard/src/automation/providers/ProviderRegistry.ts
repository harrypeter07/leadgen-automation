import {
  PublishingProvider,
  MessagingProvider,
  AnalyticsProvider,
  AIProvider,
  CRMProvider,
  OutreachProvider
} from './interfaces';

export class ProviderRegistry {
  private static instance: ProviderRegistry;

  private publishingProviders: Map<string, PublishingProvider> = new Map();
  private messagingProviders: Map<string, MessagingProvider> = new Map();
  private analyticsProviders: Map<string, AnalyticsProvider> = new Map();
  private aiProviders: Map<string, AIProvider> = new Map();
  private crmProviders: Map<string, CRMProvider> = new Map();
  private outreachProviders: Map<string, OutreachProvider> = new Map();

  private constructor() {}

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  // Register methods
  public registerPublishing(name: string, provider: PublishingProvider): void {
    this.publishingProviders.set(name.toLowerCase(), provider);
  }

  public registerMessaging(name: string, provider: MessagingProvider): void {
    this.messagingProviders.set(name.toLowerCase(), provider);
  }

  public registerAnalytics(name: string, provider: AnalyticsProvider): void {
    this.analyticsProviders.set(name.toLowerCase(), provider);
  }

  public registerAI(name: string, provider: AIProvider): void {
    this.aiProviders.set(name.toLowerCase(), provider);
  }

  public registerCRM(name: string, provider: CRMProvider): void {
    this.crmProviders.set(name.toLowerCase(), provider);
  }

  public registerOutreach(name: string, provider: OutreachProvider): void {
    this.outreachProviders.set(name.toLowerCase(), provider);
  }

  // Resolve methods
  public resolvePublishing(name: string): PublishingProvider {
    const provider = this.publishingProviders.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`PublishingProvider for platform "${name}" not registered`);
    }
    return provider;
  }

  public resolveMessaging(name: string): MessagingProvider {
    const provider = this.messagingProviders.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`MessagingProvider for platform "${name}" not registered`);
    }
    return provider;
  }

  public resolveAnalytics(name: string): AnalyticsProvider {
    const provider = this.analyticsProviders.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`AnalyticsProvider for platform "${name}" not registered`);
    }
    return provider;
  }

  public resolveAI(name: string): AIProvider {
    const provider = this.aiProviders.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`AIProvider for name "${name}" not registered`);
    }
    return provider;
  }

  public resolveCRM(name: string): CRMProvider {
    const provider = this.crmProviders.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`CRMProvider for name "${name}" not registered`);
    }
    return provider;
  }

  public resolveOutreach(name: string): OutreachProvider {
    const provider = this.outreachProviders.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`OutreachProvider for name "${name}" not registered`);
    }
    return provider;
  }

  public clearRegistry(): void {
    this.publishingProviders.clear();
    this.messagingProviders.clear();
    this.analyticsProviders.clear();
    this.aiProviders.clear();
    this.crmProviders.clear();
    this.outreachProviders.clear();
  }
}
