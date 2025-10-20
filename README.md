# **Confluent - AI-Powered Accounting Integration**

<div align="center">
  <img src="client/public/confluent.png" alt="confluent Logo" width="120" height="120" style="border-radius: 50%;">
  
  **An Accounting AI-powered agent that allows for AI-driven financial workflows**
</div>

An AI-driven MCP and agent for seamless accounting data access and automation with Zoho and Xero

---

## **Overview**
Confluent is an innovative solution built for the ADK-TS Hackathon 2025, providing a Model Context Protocol (MCP) server and AI agent to integrate with Zoho and Xero accounting platforms. It enables developers to create AI-driven financial workflows, offering seamless access to accounting data, invoice creation, and automated email notifications, all powered by the ADK-TS framework.

---

## **Features**

### **MCP Integration**
- **Zoho & Xero Connectivity:** Unified access to accounting data via OAuth authentication.
- **Financial Data Access:** Retrieve financial summaries, contact lists, and invoices.
- **Invoice Automation:** Create and manage invoices directly on Zoho or Xero.
- **Email Notifications:** Send professional invoice emails or custom messages via Resend.

### **AI Agent Capabilities**
- **Intelligent Workflows:** Autonomous reasoning for financial tasks like summarizing data or creating invoices.
- **Multi-Step Automation:** Handles complex tasks like contact creation followed by invoicing.
- **Error Handling:** Graceful recovery for authentication or tenant selection issues.
- **Customizable Tools:** Extensible tools for financial operations and email generation.

### **Client Interfaces**
- **Terminal Client:** Interact with the AI agent via a simple command-line interface.
- **Discord Bot:** Real-time interaction through Discord for financial queries and automation.
- **Scalable Sessions:** Supports multiple users with session management for personalized experiences.

### **Security & Authentication**
- **OAuth Integration:** Secure connections to Zoho and Xero with token refresh.
- **Redis-Backed Storage:** Safe management of user tokens and organization IDs.
- **Error Recovery:** Guides users through authentication or tenant selection seamlessly.

---

## **Architecture**
Confluent is structured into three core components:

- **MCP Server:** Handles API integrations with Zoho, Xero, and Resend, providing a unified interface for financial data and actions.  
- **AI Agent:** Built with ADK-TS, orchestrates financial workflows, processes user prompts, and interacts with the MCP server.  
- **Clients:** Terminal and Discord interfaces for user interaction, enabling seamless access to financial tools.

---

## **Technology Stack**

| Component | Technology |
|------------|-------------|
| Backend | Node.js, TypeScript, ADK-TS, Redis |
| Database | Redis | 
| Integrations | Zoho Books, Xero, Resend |
| Clients | Discord, terminal |

---

## **Quick Start**

### **Prerequisites**
- Node.js 18+
- Redis (Upstash)
- Zoho Books/Xero API credentials
- Resend API key
- Discord bot token (for Discord client - Optional)

### **Installation**
```bash
# Clone the repository
git clone https://github.com/Davidthecode/financialsync.git
cd financialsync


# Set up environment variables
# can find in .env.example
# Update .env with your Zoho, Xero, Resend, and Redis credentials.

# Start the MCP server
cd mcp
pnpm install
pnpm run dev

# Start the AI agent
cd agent
pnpm install
pnpm run start

# Run the client
cd client
pnpm install

(choose one)
# Terminal:
pnpm run start

# Discord:
pnpm run start:discord

```

## **AI Integration**

### **ADK-TS Framework**
- **Multi-Tool Workflows:** Coordinates tasks like contact creation, invoice generation, and email sending.  
- **Custom Tools:** Specialized tools for financial data retrieval, invoice creation, and email generation.  
- **Session Management:** Supports multiple users with InMemorySessionService.  
- **Error Handling:** Robust recovery for authentication, tenant selection, and API errors.  

### **Agent Capabilities**
- **Financial Summaries:** Aggregates revenue, expenses, and net income.  
- **Invoice Automation:** Creates invoices and sends professional emails.  
- **Contact Management:** Adds and retrieves customer/vendor details.  
- **Authentication Guidance:** Walks users through OAuth and tenant selection.
