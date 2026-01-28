import React from 'react';
import { Link } from 'react-router-dom';

const Privacy = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full bg-white shadow-soft rounded-lg p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Last updated: {new Date().getFullYear()}
        </p>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
          <p>
            This Privacy Policy explains how <strong>W | Technology</strong> (<strong>&quot;we&quot;, &quot;us&quot;, &quot;our&quot;</strong>)
            collects, uses and protects information when you use the{' '}
            <strong>Client Management System</strong> and integrated{' '}
            <strong>Project Management (PM) workspace</strong> (the <strong>&quot;Service&quot;</strong>).
            By creating an account, registering a workspace or using the Service, you
            agree to the practices described here.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              1. Information We Collect
            </h2>
            <p className="mb-2">
              We collect the following categories of information when you use the
              Service:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Account information</strong>: name, email address, workspace
                name, hashed password and basic profile details.
              </li>
              <li>
                <strong>Workspace &amp; business data</strong>: client records, projects,
                quotations, invoices, conversations, uploaded files, PM entities (epics,
                user stories, tasks, subtasks, sprints, time logs) and any notes or
                custom fields you store in the system.
              </li>
              <li>
                <strong>Technical information</strong>: IP address, browser type,
                device information and basic usage logs (such as access times and
                request paths) collected by our servers for security and auditing.
              </li>
              <li>
                <strong>Communication information</strong>: email content we generate
                on your behalf (for example, verification emails, client login
                credentials, project or invoice notifications).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              2. How We Use Your Information
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>To create and manage your user account and workspace.</li>
              <li>
                To provide core features of the Service, including client and project
                management, PM boards, chat, reporting and file management.
              </li>
              <li>
                To send essential transactional emails such as registration
                confirmations, email verification links, password‑related messages,
                client access credentials, project or invoice updates and other
                system notifications.
              </li>
              <li>
                To secure the platform, prevent abuse, troubleshoot issues and monitor
                performance.
              </li>
              <li>
                To improve and develop the Service based on aggregated/anonymous usage
                information.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              3. Cookies &amp; Similar Technologies
            </h2>
            <p>
              The Service uses cookies or similar technologies primarily to maintain
              your login session (authentication token) and remember basic preferences.
              You can control cookies through your browser settings, but disabling
              essential cookies may affect your ability to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              4. Data Sharing &amp; Third‑Party Services
            </h2>
            <p className="mb-2">
              We do not sell your personal data. We may share limited information with:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Hosting providers</strong> that run our application and
                database infrastructure.
              </li>
              <li>
                <strong>Email delivery services</strong> (for example, SendGrid or
                other SMTP providers) to send verification emails, client credentials
                and other transactional messages.
              </li>
              <li>
                <strong>Service providers</strong> that help us monitor, secure and
                maintain the platform.
              </li>
            </ul>
            <p className="mt-2">
              When you configure your own SMTP / SendGrid settings inside your
              workspace, those credentials are stored securely in your workspace
              configuration and are used only to send emails on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              5. Data Retention
            </h2>
            <p>
              We retain your account and workspace data for as long as your account is
              active or as needed to provide the Service. If you request deletion of
              your account or workspace, we will delete or anonymise your identifiable
              data within a reasonable time, subject to any legal or contractual
              obligations to retain certain records (for example, accounting or audit
              logs).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              6. Security
            </h2>
            <p>
              We implement reasonable technical and organisational measures to protect
              your data, including password hashing, logical workspace isolation and
              role‑based access controls. However, no online service can guarantee
              absolute security. You are responsible for choosing a strong password,
              keeping your credentials confidential and managing user access within your
              workspace.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              7. Your Rights &amp; Choices
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>You may access and update your profile information from within the app.</li>
              <li>
                Workspace owners can add, update or delete client and project data stored
                in their workspace.
              </li>
              <li>
                You may request that we delete your account or provide a copy of your
                personal data, subject to identity verification and applicable law.
              </li>
              <li>
                You can opt out of non‑essential communications (if any) while still
                receiving important transactional or security emails.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              8. International Transfers
            </h2>
            <p>
              Our infrastructure or service providers may be located in different
              countries. By using the Service, you consent to the transfer and
              processing of your information outside of your country of residence,
              subject to appropriate safeguards.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. When we make material
              changes, we will provide notice through the Service or by email. Your
              continued use of the Service after the effective date of the updated
              policy constitutes your acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              10. Contact Us
            </h2>
            <p>
              If you have questions about this Privacy Policy or how we handle your
              data, please contact us at{' '}
              <a href="mailto:info@wtechnology.in" className="text-primary-600 hover:text-primary-500 underline">
                info@wtechnology.in
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-6 flex justify-between items-center text-xs text-gray-500">
          <Link to="/terms" className="text-primary-600 hover:text-primary-500">
            View Terms &amp; Conditions
          </Link>
          <Link to="/register" className="hover:text-gray-700">
            Back to Registration
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Privacy;

