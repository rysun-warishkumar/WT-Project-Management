/**
 * Inquiries from the public marketing website (Get in touch + Get started forms).
 * POST is public (no auth). GET is super admin only.
 */

const ENQUIRY_TYPES = ['contact', 'get_started'];

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { query: dbQuery } = require('../config/database');

const router = express.Router();

const superAdminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!req.isSuperAdmin && !req.user.is_super_admin && !req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required',
    });
  }
  next();
};

const postValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 255 }).withMessage('Name too long'),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email').normalizeEmail(),
  body('subject').optional({ values: 'null' }).trim().isLength({ max: 500 }).withMessage('Subject too long'),
  body('message').optional({ values: 'null' }).trim(),
  body('enquiry_type').optional({ values: 'null' }).trim().isIn(ENQUIRY_TYPES).withMessage('enquiry_type must be contact or get_started'),
  body('company').optional({ values: 'null' }).trim().isLength({ max: 255 }).withMessage('Company too long'),
];

// POST /api/inquiries – public (no auth), from static marketing site forms
router.post(
  '/',
  postValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
        });
      }
      const { name, email, subject, message, enquiry_type, company } = req.body;
      const type = enquiry_type && ENQUIRY_TYPES.includes(enquiry_type) ? enquiry_type : 'contact';
      const msg = message != null && String(message).trim() !== '' ? String(message).trim() : '';
      if (type === 'contact' && msg === '') {
        return res.status(400).json({
          success: false,
          message: 'Message is required for contact inquiries',
        });
      }
      try {
        await dbQuery(
          `INSERT INTO inquiries (name, email, subject, message, enquiry_type, company) VALUES (?, ?, ?, ?, ?, ?)`,
          [name, email, subject || null, msg, type, company || null]
        );
      } catch (insertErr) {
        if (insertErr.code === 'ER_BAD_FIELD_ERROR') {
          await dbQuery(
            `INSERT INTO inquiries (name, email, subject, message) VALUES (?, ?, ?, ?)`,
            [name, email, subject || null, msg]
          );
        } else {
          throw insertErr;
        }
      }
      res.status(201).json({ success: true, message: 'Inquiry submitted successfully' });
    } catch (err) {
      console.error('Error submitting inquiry:', err);
      res.status(500).json({ success: false, message: 'Failed to submit inquiry' });
    }
  }
);

// GET /api/inquiries – super admin only (works with or without enquiry_type/company columns)
router.get('/', authenticateToken, superAdminOnly, async (req, res) => {
  try {
    let rows;
    try {
      rows = await dbQuery(
        `SELECT id, name, email, subject, message, enquiry_type, company, created_at
         FROM inquiries
         ORDER BY created_at DESC`
      );
    } catch (selectErr) {
      if (selectErr.code === 'ER_BAD_FIELD_ERROR') {
        rows = await dbQuery(
          `SELECT id, name, email, subject, message, created_at FROM inquiries ORDER BY created_at DESC`
        );
        rows = rows.map((r) => ({ ...r, enquiry_type: 'contact', company: null }));
      } else {
        throw selectErr;
      }
    }
    res.json({
      success: true,
      data: { inquiries: rows },
    });
  } catch (err) {
    console.error('Error fetching inquiries:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inquiries',
    });
  }
});

module.exports = router;
