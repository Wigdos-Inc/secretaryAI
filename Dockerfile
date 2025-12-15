# Dockerfile for Render / general PHP Apache deployment
FROM php:8.2-apache

# Install system deps and PHP extensions
RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip zip libzip-dev libonig-dev \
    && docker-php-ext-install pdo pdo_mysql \
    && rm -rf /var/lib/apt/lists/*

# Enable Apache rewrite
RUN a2enmod rewrite

WORKDIR /var/www/html

# Copy application code
COPY . /var/www/html

# Ensure webserver owns files
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80
CMD ["apache2-foreground"]
