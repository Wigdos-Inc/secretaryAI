<?php

require_once 'data.php';

// Display data for testing
#echo "<pre>\n";
#echo "--- NEWSLETTERS ---\n";
#print_r($newsletters);
#echo "\n--- CATEGORIES ---\n";
#print_r($categories);
#echo "\n--- Users ---\n";
#print_r($users);
#echo "</pre>\n";

echo "<pre>\n";
echo "--- NEWSLETTERS ---\n";
print_r($_SESSION['newsletters']);
echo "\n--- CATEGORIES ---\n";
print_r($_SESSION['categories']);
echo "\n--- Users ---\n";
print_r($_SESSION['users']);
echo "</pre>\n";

// https://102871.stu.sd-lab.nl/beroeps/newsletters/scripts/db/dataTest.php