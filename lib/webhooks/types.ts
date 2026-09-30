export type WebhookEventStatus = "processing" | "succeeded" | "failed";

export type WebhookEventRecord = {
  requestId: string;
  status: WebhookEventStatus;
  executionId: number | null;
  responseJson: string;
  errorMessage: string;
};

export type ReserveWebhookEventInput = {
  ownerHash: string;
  keyHash: string;
  requestId: string;
  eventType: string;
};

export interface WebhookEventStore {
  find(ownerHash: string, keyHash: string): Promise<WebhookEventRecord | null>;
  reserve(input: ReserveWebhookEventInput): Promise<boolean>;
  succeed(
    requestId: string,
    executionId: number,
    responseJson: string,
  ): Promise<void>;
  fail(requestId: string, errorMessage: string): Promise<void>;
}
