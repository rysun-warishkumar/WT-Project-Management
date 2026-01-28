import React from 'react';
import { Link } from 'react-router-dom';

const Terms = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full bg-white shadow-soft rounded-lg p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Terms &amp; Conditions
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Last updated: {new Date().getFullYear()}
        </p>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
          <p>
            These Terms &amp; Conditions (<strong>&quot;Terms&quot;</strong>) govern your access to and
            use of the <strong>Client Management System</strong> and the integrated{' '}
            <strong>Project Management (PM) workspace</strong> (collectively, the
            <strong> &quot;Service&quot;</strong>) provided by <strong>W | Technology</strong>{' '}
            (<strong>&quot;we&quot;, &quot;us&quot;, &quot;our&quot;</strong>). By creating an account, registering a
            workspace, or using the Service in any way, you agree to be bound by these Terms.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              1. Description of the Service
            </h2>
            <p>
              The Service is a multi-tenant SaaS platform that allows you to manage
              clients, projects, quotations, invoices, conversations, credentials and
              software development workspaces (including epics, user stories, tasks,
              subtasks, sprints, reports and chat). Each registered user can act as an
              administrator of their own workspace, invite members and configure basic
              settings such as SMTP/email integration.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              2. Account Registration &amp; Responsibilities
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                You must provide accurate and complete information during registration,
                including a valid email address and workspace name.
              </li>
              <li>
                You are responsible for maintaining the confidentiality of your login
                credentials and for all activity that occurs under your account.
              </li>
              <li>
                You must ensure that any invited users in your workspace are authorised
                and understand these Terms and the{' '}
                <Link to="/privacy" className="text-primary-600 hover:text-primary-500 underline">
                  Privacy Policy
                </Link>
                .
              </li>
              <li>
                You must immediately notify us of any unauthorised access to or use of
                your account.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              3. Acceptable Use
            </h2>
            <p className="mb-2">
              You agree not to use the Service for any unlawful, harmful or abusive
              purpose, including (without limitation):
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Uploading or storing illegal, offensive or infringing content.</li>
              <li>
                Attempting to gain unauthorised access to other workspaces or data that
                does not belong to you.
              </li>
              <li>
                Interfering with or disrupting the integrity or performance of the
                Service.
              </li>
              <li>
                Using the Service to send unsolicited or bulk marketing emails (spam).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              4. Workspace &amp; Data Ownership
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Each workspace is logically isolated by a workspace identifier. You are
                responsible for all data created or imported into your workspace.
              </li>
              <li>
                You retain ownership of the data you store in the Service. We do not
                claim ownership of your client, project or workspace data.
              </li>
              <li>
                You grant us a limited licence to host, process, back up and transmit your
                data solely for the purpose of providing and improving the Service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              5. Email, Notifications &amp; SMTP
            </h2>
            <p className="mb-2">
              The Service sends transactional emails such as registration confirmations,
              verification links, client credentials, project notifications and invoice
              communications. Emails can be sent either using our default SMTP
              configuration or using the SMTP / SendGrid settings you configure in your
              workspace.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                When you configure your own SMTP / SendGrid settings, you are responsible
                for ensuring that you have the right to use that email infrastructure and
                that your usage complies with any third‑party terms.
              </li>
              <li>
                We may send you important service, security or legal notifications to the
                email associated with your account.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              6. Data Protection &amp; Privacy
            </h2>
            <p>
              Our collection and use of personal data is described in our{' '}
              <Link to="/privacy" className="text-primary-600 hover:text-primary-500 underline">
                Privacy Policy
              </Link>
              . By using the Service you agree that we may process your data in accordance
              with that policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              7. Service Availability &amp; Changes
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                We aim to keep the Service available and performant, but we do not
                guarantee uninterrupted or error‑free operation.
              </li>
              <li>
                We may modify, suspend or discontinue parts of the Service (such as
                features, modules or integrations) with reasonable notice where
                practicable.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              8. Fees &amp; Plans
            </h2>
            <p>
              We may offer free and paid plans for the Service. Any pricing, billing
              terms and plan limits will be communicated separately. If you are on a paid
              plan, you agree to pay all applicable fees and taxes in a timely manner.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              9. Termination
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                You may stop using the Service at any time. You may also request deletion
                of your account and workspace data subject to reasonable verification.
              </li>
              <li>
                We may suspend or terminate your access if you materially breach these
                Terms, misuse the Service, or create security or legal risk for us or
                other users.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              10. Disclaimer &amp; Limitation of Liability
            </h2>
            <p className="mb-2">
              The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the
              maximum extent permitted by law, we disclaim all warranties, express or
              implied, including fitness for a particular purpose and non‑infringement.
            </p>
            <p>
              To the extent permitted by law, our total liability for any claim arising
              out of or relating to the Service will be limited to the amount you paid
              (if any) for the Service during the 12 months preceding the event giving
              rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              11. Changes to These Terms
            </h2>
            <p>
              We may update these Terms from time to time to reflect changes in the
              Service or applicable law. When we make material changes, we will provide
              notice through the Service or by email. Your continued use of the Service
              after the effective date of the updated Terms constitutes your acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              12. Contact
            </h2>
            <p>
              If you have any questions about these Terms, please contact us at{' '}
              <a href="mailto:info@wtechnology.in" className="text-primary-600 hover:text-primary-500 underline">
                info@wtechnology.in
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-6 flex justify-between items-center text-xs text-gray-500">
          <Link to="/privacy" className="text-primary-600 hover:text-primary-500">
            View Privacy Policy
          </Link>
          <Link to="/register" className="hover:text-gray-700">
            Back to Registration
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Terms;

