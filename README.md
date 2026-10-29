# Monthly Invoice Automation (n8n)

Every month on the 28th, this n8n workflow:

1. Duplicates the latest month's tab in your invoice workbook (Google Sheets)
2. Increments the invoice number and sets the invoice date and period
3. Exports the invoice (A1:H22) as a PDF and saves it to your Drive folder
4. Copies the Non-GST declaration template, fills in the date and exports it as a PDF
5. Emails both PDFs to the recipient from your Gmail

Everything runs on **your own laptop** with Docker, using **your own Google account**.

---

## What you need

- **Docker Desktop** – install from https://www.docker.com/products/docker-desktop/
- **Git** (or download this repo as a ZIP)
- A Google account. If you're in the coss.org.in Workspace, you can use the shared Google client (ask Yeswanth). Otherwise, see [Using your own Google client](#using-your-own-google-client).

---

## Setup (about 10 minutes)

### 1. Get the code

```bash
git clone https://github.com/Yeswanth07/invoice-automation
cd invoice-automation
```

### 2. Add the Google client

Copy the example settings file:

```bash
cp .env.example .env
```

(On Windows PowerShell: `copy .env.example .env`)

Open `.env` in any text editor and paste in the **Client ID** and **Client Secret**. Ask Yeswanth for them privately, or create your own (see below). Leave everything else as it is.

> `.env` is in `.gitignore`. Never commit it or share it in a group chat.

### 3. Start n8n

```bash
docker compose up -d
```

The first time, this downloads n8n and runs a one-time setup. The setup:

- creates four Google credentials (Sheets, Drive, Docs and Gmail) with the client already filled in
- imports the invoice workflow with every node already linked to those credentials

To check that it worked:

```bash
docker compose logs setup
```

You should see `[setup] Done.`

### 4. First launch

1. Open **http://localhost:5678**.
2. Create your n8n account. This is local to your laptop, so any email and password will do.

### 5. Sign in to Google (4 clicks)

1. In n8n, open **Overview → Credentials**.
2. Open each of these four credentials, click **Sign in with Google**, choose your account and click **Allow**:
   - Google Sheets account
   - Google Drive account
   - Google Docs account
   - Gmail account
3. Each one should show **Account connected**. Click **Save** and close it.

### 6. Upload your invoice and declaration to Google Drive

You'll need three things in your Google Drive: your invoice workbook, your declaration, and a folder for the monthly PDFs.

**Invoice workbook**

1. Upload your invoice spreadsheet to Google Drive. If it's already a Google Sheet, skip this.
2. If it's an Excel file (.xlsx), open it from Drive and choose **File → Save as Google Sheets**. Use the new Google Sheets copy from now on. The workflow can't edit .xlsx files.
3. Make sure it follows these rules:
   - **One tab per month**, named in the format `Month YYYY`, e.g. `October 2026`. The workflow copies the latest month's tab, so you need at least one tab with your most recent invoice.
   - **Invoice number** in **D2**, e.g. `INV_05`. The workflow adds 1 to the number each month.
   - **Invoice date** in **D3** and **period** in **D6**.
   - Everything to print fits inside **A1:H22**.

   If your layout uses different cells, that's fine. Just enter your cells in the Config node in step 7. A different print area can be changed in the **Export Sheet as PDF** node's URL (`range=A1%3AH22`).

**Non-GST declaration**

1. Upload your declaration to Google Drive.
2. If it's a Word file (.docx) or a PDF, open it from Drive and choose **File → Save as Google Docs**. For a PDF, choose **Open with → Google Docs** instead. Use the new Google Docs copy from now on.
3. Replace the date in the document with exactly `[[DATE]]`. Each month, the workflow makes a copy of this document and puts the invoice date in place of `[[DATE]]`. Your original stays unchanged as the template.

**Output folder**

Create a folder in Google Drive, e.g. `Invoices & Declarations`. Each month's invoice PDF and filled-in declaration are saved here.

### 7. Fill in your details in the workflow

Open the workflow **Monthly Invoice**.

**Config node** (double-click it):

| Field | What to put |
|---|---|
| `spreadsheetId` | The ID from your workbook URL: `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit` |
| `toEmail` | Who receives the invoice. Use **your own email** while testing. |
| `declarationTemplateId` | The ID from your declaration doc URL: `docs.google.com/document/d/`**`THIS_PART`**`/edit` |
| `declarationFolderId` | The ID from your folder URL: `drive.google.com/drive/folders/`**`THIS_PART`** |
| `invoiceNoCell`, `invoiceDateCell`, `periodCell` | Leave as `D2`, `D3`, `D6` unless your layout differs. |

**Email Invoice node**: in the message, replace the recipient's name and the signature placeholders (your name, title, email and phone).

**Schedule**: the trigger node runs on the **28th at 11:00 AM IST**. To change this, edit its cron expression. For example, `0 9 25 * *` means 9 AM on the 25th.

Save the workflow (Ctrl+S, or Cmd+S on Mac).

### 8. Test, then publish

1. Click **Execute workflow**. Each node should turn green.
2. Check that:
   - a new tab for the current month is in your workbook
   - both PDFs are in your Drive folder
   - the email with both attachments arrived in your inbox
3. Delete the test tab and the test PDFs if you don't want to keep them.
4. In Config, set `toEmail` to the real recipient and save.
5. Click **Publish** at the top right.

That's it. From now on it runs by itself every month.

---

## Keeping it running

- In Docker Desktop, go to **Settings → General** and turn on **Start Docker Desktop when you sign in**. n8n restarts automatically with Docker.
- Your laptop must be **on and awake** at the scheduled time. If it's asleep, that month's run is skipped. If that happens, open n8n and click **Execute workflow** yourself.
- After each run, check the workflow's **Executions** tab:
  - green means it ran successfully
  - red means a node failed; click the run to see which one and why

---

## Using your own Google client

You only need this if you're **not** in the coss.org.in Workspace, or if you want your own Google Cloud project instead of the shared client. It takes about 10 minutes, all in the browser.

### A. Create a project and enable the APIs

1. Go to https://console.cloud.google.com and create a new project, e.g. `n8n-invoices`.
2. Go to **APIs & Services → Library**. Search for and **Enable** each of these:
   - Google Sheets API
   - Google Drive API
   - Google Docs API
   - Gmail API

> If you have the `gcloud` command-line tool installed, you can do this step with:
> ```bash
> gcloud projects create n8n-invoices-<yourname>
> gcloud config set project n8n-invoices-<yourname>
> gcloud services enable sheets.googleapis.com drive.googleapis.com docs.googleapis.com gmail.googleapis.com
> ```

### B. Configure the consent screen

1. Go to **Google Auth Platform** (APIs & Services → OAuth consent screen) and click **Get started**.
2. Fill in:
   - **App name**: `n8n invoices`
   - **User support email**: your email
3. Choose an **Audience**:
   - **Internal** if your account belongs to a Google Workspace organization. This is the simplest choice: no publishing, no warnings, and sign-ins never expire.
   - **External** if you use a personal @gmail.com account.
4. Add your email as the contact email, agree to the policy and click **Create**.

**If you chose External**, you must also publish the app. In Testing mode, Google disconnects you every 7 days.
1. Go to **Branding** and fill in the **Application home page** and **Application privacy policy link**. Any public page you control is fine.
2. Under **Authorised domains**, add that page's domain.
3. Go to **Audience** and click **Publish app**.
4. When you sign in later, Google will warn that the app is unverified. Click **Advanced → Go to n8n invoices**. That's expected for a personal app.

### C. Create the OAuth client

1. Go to **Clients → Create client**.
2. For **Application type**, choose **Web application**.
3. Under **Authorised redirect URIs**, add exactly:
   ```
   http://localhost:5678/rest/oauth2-credential/callback
   ```
4. Click **Create** and copy the **Client ID** and **Client Secret**.
5. Paste them into your `.env` file (see step 2 of Setup).

If you've **already** run setup with a different client, there's no need to re-run it. Open each of the four credentials in n8n, replace the Client ID and Secret, and click **Sign in with Google** again.

---

## Everyday commands

Run these from the repo folder:

| Task | Command |
|---|---|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| See n8n logs | `docker compose logs -f n8n` |
| Update n8n to the latest version | `docker compose pull && docker compose up -d` |
| Check the container's time and timezone | `docker exec invoice-n8n date` |

Your workflow, credentials and history live in the Docker volume `invoice_n8n_data`. They survive stopping, updating and restarting.

> ⚠️ `docker compose down -v` **deletes that volume**, along with your workflow, credentials and history. Only use it if you want to start over completely.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `docker compose up` says *service "setup" didn't complete successfully* | Run `docker compose logs setup`. Usually the Client ID or Secret is missing in `.env`, or the `workflow/` folder doesn't contain exactly one `.json` file. |
| *Port 5678 is already allocated* | Another n8n is already running. Stop it with `docker ps` then `docker stop <name>`. The port must stay 5678, because the Google redirect URL depends on it. |
| Google sign-in shows **redirect_uri_mismatch** | The redirect URI in Google Cloud must be exactly `http://localhost:5678/rest/oauth2-credential/callback`. |
| Google sign-in shows **access blocked / org_internal** | The shared client only works for coss.org.in accounts. Use your own client (see above). |
| **Get Sheet List** fails with 404 | Wrong `spreadsheetId`, or the file is an .xlsx. Open it and choose **File → Save as Google Sheets**, then use the new ID. |
| **Next Invoice No** says "No number found" | `invoiceNoCell` doesn't point at the cell containing the invoice number. |
| **Fill Date** runs but the date doesn't change | The template doesn't contain exactly `[[DATE]]`. Retype it in one go so the formatting isn't split. |
| The workflow stops after **Plan New Sheet** with no error | This month's tab already exists. That's the duplicate protection, so it's working as intended. |
| The schedule didn't run | Check that the workflow is **Published**, that Docker was running, and that the laptop was awake at the scheduled time. |

**Re-running setup from scratch:** set `FORCE_SETUP=true` in `.env`, run `docker compose up -d`, then set it back to `false`. This **overwrites** your Config and email edits and disconnects the Google sign-ins, so you'll need to redo steps 5 and 7.

---


