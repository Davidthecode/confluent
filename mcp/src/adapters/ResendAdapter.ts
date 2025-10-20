import { Resend } from "resend";

export interface EmailResult {
  email_id: string;
}

export interface GenericEmailInput {
  to: string;
  subject: string;
  html: string;
  tags?: { name: string; value: string }[];
}

export class ResendAdapter {
  private resend: Resend;
  private readonly defaultFrom: string = "onboarding@resend.dev";

  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  async sendEmail(
    input: GenericEmailInput
  ): Promise<EmailResult> {
    const { to, subject, html, tags } = input;

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.defaultFrom,
        to,
        subject,
        html,
        tags: tags,
      });

      if (error) {
        console.error("Resend API Error:", error);
        throw new Error(error.message);
      }
      return { email_id: data.id };
    } catch (error: any) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}