# Truck Ledger PDF Generation Backend

A lightweight, stateless PDF generation service for the Truck Accounts dashboard. Deployed on Render and integrated with the Next.js frontend on Vercel.

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express
- **PDF Engine**: pdfmake (built on pdfkit)
- **CORS**: Enabled for frontend access

## How it works

The backend is completely **stateless**. When a user requests a PDF, the Next.js frontend sends a POST request with the trip details and ledger logs in a JSON body. The backend compiles the data into a professional PDF layout (supporting Unicode characters like the Indian Rupee symbol `₹` via Roboto) and streams the PDF file back to the client.

## Running Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The server will run on `http://localhost:5000` (it will automatically download the required Roboto font files on first start).

## Deploying to Render

1. Create a new **Web Service** on Render.
2. Connect your Git repository.
3. Configure the following settings:
   - **Root Directory**: `truck-backend` (or leave empty if it's a dedicated repo)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
4. Add the service URL as `NEXT_PUBLIC_BACKEND_URL` in your Next.js environment variables.
