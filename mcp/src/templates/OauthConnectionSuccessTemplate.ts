import { getStyleString, styles } from "../utils/templates";

export interface ConnectionSuccessProps {
  platform: "Xero" | "Zoho";
  userId: string;
  nextStep: string;
  isError?: boolean;
  errorMessage?: string;
}

export function generateConnectionSuccessHTML({
  platform,
  userId,
  nextStep,
  isError = false,
  errorMessage,
}: ConnectionSuccessProps): string {
  const titleText = isError ? `${platform} Connection Failed` : `${platform} Connected Successfully`;
  const headerStyle = isError ? { ...styles.header, color: "#dc3545" } : styles.header;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${titleText}</title>
    </head>
    <body style="${getStyleString({ ...styles.body, textAlign: "center" })}">

        <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="450" style="${getStyleString(styles.container)}">
                        
                        <tr>
                            <td align="center" style="${getStyleString(headerStyle)}">
                                <h1 style="color: ${isError ? "#dc3545" : "#1e90ff"}; margin: 0; font-size: 24px;">${titleText}</h1>
                            </td>
                        </tr>

                        <tr>
                            <td style="${getStyleString(styles.contentPadding)}">
                                <p style="color: #555555; line-height: 1.6; font-size: 16px;">
                                    ${isError ?
      `<strong>Error Details:</strong> ${errorMessage || "An unknown error occurred during the connection process."}` :
      `Your **${platform}** account is now linked to user **${userId}**.`
    }
                                </p>
                                
                                <div style="margin: 20px 0;">
                                    <p style="color: #333333; font-size: 18px; font-weight: bold;">Next Step:</p>
                                    <p style="color: #555555; line-height: 1.6;">${nextStep}</p>
                                </div>
                                
                                <p style="color: #aaaaaa; font-size: 14px; margin-top: 40px;">You may now close this window and return to your agent conversation.</p>
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