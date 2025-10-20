import { getStyleString, styles } from "../utils/templates";

export interface InvoiceEmailProps {
  invoiceId: string;
  amount: number;
  dueDate: string;
  companyName: string;
}

export function generateInvoiceEmailHTML({
  invoiceId,
  amount,
  dueDate,
  companyName,
}: InvoiceEmailProps): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice from ${companyName}</title>
    </head>
    <body style="${getStyleString(styles.body)}">

        <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
                <td align="center" style="padding: 20px 0;">
                    <table border="0" cellpadding="0" cellspacing="0" width="600" style="${getStyleString(styles.container)}">
                        
                        <tr>
                            <td align="center" style="${getStyleString(styles.header)}">
                                <h1 style="color: #333333; margin: 0; font-size: 28px;">${companyName}</h1>
                            </td>
                        </tr>

                        <tr>
                            <td style="${getStyleString(styles.contentPadding)}">
                                <h2 style="color: #333333; margin-top: 0; font-size: 24px; font-weight: bold;">Invoice #${invoiceId} is Due</h2>
                                <p style="color: #555555; line-height: 1.6;">Dear Client,</p>
                                <p style="color: #555555; line-height: 1.6;">Please find the details for your recent invoice below.</p>

                                <table border="0" cellpadding="0" cellspacing="0" style="${getStyleString(styles.detailTable)}">
                                    <tr>
                                        <td style="${getStyleString(styles.rowLight)}">Invoice ID:</td>
                                        <td style="${getStyleString({ ...styles.rowLight, textAlign: 'right' })}">${invoiceId}</td>
                                    </tr>
                                    <tr>
                                        <td style="${getStyleString(styles.rowWhite)}">Amount Due:</td>
                                        <td style="${getStyleString({ ...styles.amountText, borderTop: '1px solid #eeeeee' })}">$${amount.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td style="${getStyleString(styles.rowLight)}">Due Date:</td>
                                        <td style="${getStyleString({ ...styles.rowLight, textAlign: 'right' })}">${dueDate}</td>
                                    </tr>
                                </table>

                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="[Your Payment Link Here]" target="_blank" style="display: inline-block; padding: 12px 25px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                        View & Pay Invoice
                                    </a>
                                </div>
                                
                                <p style="color: #555555; line-height: 1.6; margin-top: 30px;">Thank you for your prompt attention to this matter.</p>
                                <p style="color: #555555; line-height: 1.6; margin-bottom: 0;">Best regards,<br>${companyName} Team</p>
                            </td>
                        </tr>

                        <tr>
                            <td align="center" style="padding: 20px 50px; border-top: 1px solid #eeeeee;">
                                <p style="color: #aaaaaa; font-size: 12px; margin: 0;">This is an automated email. Please do not reply.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}