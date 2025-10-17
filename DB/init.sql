CREATE USER IF NOT EXISTS 'sandboxuser'@'%' IDENTIFIED BY 'sandboxuser_pass';
GRANT ALL PRIVILEGES ON sandbox.* TO 'sandboxuser'@'%';
FLUSH PRIVILEGES;
