# Hostinger MySQL Database Setup Guide

This guide will help you set up MySQL database on Hostinger hPanel for use with your Render deployment.

## 📋 Step-by-Step Instructions

### Step 1: Access Hostinger hPanel

1. Log in to your Hostinger account
2. Navigate to **hPanel** (Hosting Control Panel)
3. Find the **Databases** section

### Step 2: Create MySQL Database

1. Click on **MySQL Databases** or **phpMyAdmin**
2. Click **Create New Database**
3. Fill in the details:
   - **Database Name**: `client_management` (or your preferred name)
   - **Database User**: Create a new user (recommended) or select existing
   - **Password**: Generate a strong password (save it securely!)
4. Click **Create** or **Add Database**

### Step 3: Note Database Credentials

After creation, note down:
- **Database Host**: Usually `localhost` or `mysql.hostinger.com` or `your-domain.com`
- **Database Name**: The name you created
- **Database Username**: The username you created
- **Database Password**: The password you set
- **Database Port**: Usually `3306`

**Important**: Save these credentials securely. You'll need them for Render environment variables.

### Step 4: Configure Remote Access (if needed)

Some Hostinger plans allow remote MySQL connections:

1. In hPanel, find **Remote MySQL** or **Remote Database Access**
2. Add Render's IP addresses (you may need to contact Render support for these)
3. Or add `%` to allow all IPs (less secure, use only for testing)

**Note**: Many Hostinger shared hosting plans **do not allow remote MySQL connections**. In that case:

**Option A**: Use Hostinger's database only if you can access it from Render
- Some plans allow connections from specific IPs
- Contact Hostinger support to enable remote access

**Option B**: Use an alternative database service:
- **PlanetScale** (MySQL-compatible, free tier available)
- **AWS RDS** (MySQL, pay-as-you-go)
- **Render PostgreSQL** (free tier available, requires schema migration)
- **Railway** (MySQL, free tier available)

### Step 5: Import Database Schema

1. In hPanel, go to **phpMyAdmin**
2. Select your database from the left sidebar
3. Click the **Import** tab
4. Click **Choose File**
5. Select `database/complete_schema.sql` from your project
6. Click **Go** at the bottom
7. Wait for import to complete
8. Verify tables are created:
   - Check for tables like `users`, `clients`, `projects`, `pm_workspaces`, etc.

### Step 6: Verify Database Connection

You can test the connection using phpMyAdmin:
1. Go to **phpMyAdmin**
2. Select your database
3. Try running a simple query: `SELECT 1;`
4. If it works, your database is ready

### Step 7: Configure Render Environment Variables

In your Render backend service, set these environment variables:

```env
DB_HOST=your-hostinger-db-host
DB_USER=your-db-username
DB_PASSWORD=your-db-password
DB_NAME=client_management
DB_PORT=3306
```

### Step 8: Test Connection from Render

1. Deploy your backend to Render
2. Check Render logs for database connection messages
3. If you see "✅ Database connected successfully", you're good!
4. If you see connection errors, see troubleshooting below

---

## 🔧 Troubleshooting

### Issue: "Access denied for user"

**Possible Causes**:
- Wrong username or password
- User doesn't have proper permissions
- User is not allowed to connect from Render's IP

**Solutions**:
1. Double-check username and password in Render environment variables
2. In Hostinger, verify user has all privileges on the database
3. Check Remote MySQL settings if applicable
4. Try creating a new database user with full privileges

### Issue: "Can't connect to MySQL server"

**Possible Causes**:
- Hostinger doesn't allow remote connections
- Wrong database host
- Firewall blocking connection
- Database server is down

**Solutions**:
1. Verify database host is correct (not `localhost` for remote connections)
2. Check if Hostinger plan supports remote MySQL
3. Contact Hostinger support to enable remote access
4. Consider using an alternative database service (see Option B above)

### Issue: "Unknown database"

**Possible Causes**:
- Database name is incorrect
- Database doesn't exist
- User doesn't have access to the database

**Solutions**:
1. Verify database name matches exactly (case-sensitive)
2. Check database exists in phpMyAdmin
3. Ensure user has access to the database

### Issue: Connection timeout

**Possible Causes**:
- Network issues
- Database server overloaded
- Firewall blocking

**Solutions**:
1. Check Hostinger server status
2. Try increasing connection timeout in database config
3. Contact Hostinger support

---

## 🔒 Security Best Practices

1. **Use Strong Passwords**: Generate complex passwords for database users
2. **Limit Remote Access**: Only allow connections from Render's IPs if possible
3. **Regular Backups**: Set up automatic backups in Hostinger
4. **Monitor Access**: Check database access logs regularly
5. **Update Regularly**: Keep MySQL and your application updated

---

## 📊 Database Maintenance

### Regular Backups

1. In Hostinger hPanel, go to **Backups**
2. Set up automatic daily/weekly backups
3. Or manually export database from phpMyAdmin

### Monitor Usage

1. Check database size in hPanel
2. Monitor query performance
3. Optimize tables if needed (phpMyAdmin → Operations → Optimize table)

### Clean Up

- Remove old/unused data regularly
- Archive old records if needed
- Monitor table sizes

---

## 💡 Alternative: Using Render PostgreSQL

If Hostinger MySQL remote access is not available, consider using Render's PostgreSQL:

1. In Render, create a **PostgreSQL** database
2. Convert MySQL schema to PostgreSQL (tools available online)
3. Update database connection in your code
4. Deploy with PostgreSQL connection string

**Pros**:
- Free tier available
- Easy to set up
- Integrated with Render
- Automatic backups

**Cons**:
- Requires schema migration
- Different SQL syntax in some cases

---

## 📞 Support Resources

- **Hostinger Support**: Check hPanel support section or contact support
- **Render Docs**: [render.com/docs](https://render.com/docs)
- **MySQL Docs**: [dev.mysql.com/doc](https://dev.mysql.com/doc/)

---

**Last Updated**: 2024
