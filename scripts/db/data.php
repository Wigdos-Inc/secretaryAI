<?php


// DB Connect
require_once 'config.php';

// Get UserID
$userID = isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : null;



/* === Main Data Queries === */

// Check if DB is up
if (!$dbStatus) die("No DB Connection");

// Prep Query Function
function iniData(PDO $pdo, string $query, string $idKey, array $extra) {

    $output = [];
    foreach ($pdo->query($query, PDO::FETCH_ASSOC) as $row) {

        if (!array_key_exists($idKey, $row)) {
            trigger_error("Warning: $idKey not found in query results", E_USER_WARNING);
            return [];
        }
        $output[$row[$idKey]] = $row + $extra;
    }

    return $output;
}

// Function Call Structure:
# DB Access                    - $pdo
# Query                        - String
# Name ID Column               - String
# Additional Output Structure  - Array

// Fetch Data
$newsletters = iniData(
    $pdo,
    "SELECT * FROM tab_newsletters ORDER BY creation_date DESC", 
    'newsletter_ID', 
    [
        'contributors' => [],
        'favorited_by' => [],
        'categories'   => []
    ]
);
$categories = iniData(
    $pdo,
    "SELECT * FROM tab_categories", 
    'category_ID', 
    [
        'contributors' => [],
        'favorited_by' => [],
        'newsletters'  => []
    ]
);
$users = iniData(
    $pdo,
    "SELECT user_ID, username, creation_date, role FROM tab_users", 
    'user_ID', 
    [
        'f_newsletters' => [],
        'f_categories'  => [],
        'f_users'       => [],
        'c_newsletters' => [],
        'c_categories'  => [],
        'favorited_by'  => [],
        'creations'     => []
    ]
);

// Get Inbox Items
$inboxAmount;
if ($userID) {

    $stmt = $pdo->prepare("SELECT * FROM tab_inbox WHERE user_ID = ? AND status = 'unread'");
    $stmt->execute([$userID]);
    $inboxAmount = $stmt->rowCount();

}

/* === Connection Table Queries === */

// Loop Structure
$loopStruc = [
    'tables'     => [                   // Many-to-Many
        'con_newsletter_categories',    // 0: Newsletters-Categories
        'con_user_newsletters',         // 1: Newsletters-Contributors
        'con_user_categories',          // 2: Categories-Contributors
        'con_favorites_newsletters',    // 3: User Favorites-Newsletters
        'con_favorites_categories',     // 4: User Favorites-Categories
        'con_favorites_creators'        // 5: User Favorites-Creators
    ],
    'idKeys'     => [
        ['newsletter_ID', 'category_ID'],      // 0
        ['user_ID', 'newsletter_ID'],          // 1
        ['user_ID', 'category_ID'],            // 2
        ['user_ID', 'newsletter_ID'],          // 3
        ['user_ID', 'category_ID'],            // 4
        ['user_ID', 'favorite_user_ID']        // 5
    ],
    'targets'    => [
        [&$newsletters, &$categories],         // 0
        [&$users, &$newsletters],              // 1
        [&$users, &$categories],               // 2
        [&$users, &$newsletters],              // 3
        [&$users, &$categories],               // 4
        [&$users, &$users]                     // 5
    ],
    'properties' => [
        ['categories', 'newsletters'],         // 0
        ['c_newsletters', 'contributors'],     // 1
        ['c_categories', 'contributors'],      // 2
        ['f_newsletters', 'favorited_by'],     // 3
        ['f_categories', 'favorited_by'],      // 4
        ['f_users', 'favorited_by']            // 5
    ]
];

// Add Connection Data (skip missing tables instead of failing)
for ($i=0; $i < count($loopStruc['tables']); $i++) {
    $table = $loopStruc['tables'][$i];
    try {
        $stmt = $pdo->query("SELECT * FROM {$table}", PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        // If table doesn't exist, skip and continue; otherwise log and continue
        $sqlState = $e->getCode();
        error_log("Warning: could not query table {$table}: " . $e->getMessage());
        continue;
    }

    // Iterate through Table Rows
    foreach ($stmt as $row) {

        // Easier Access
        $ids   = [$row[$loopStruc['idKeys'][$i][0]], $row[$loopStruc['idKeys'][$i][1]]];
        $tgts  = &$loopStruc['targets'][$i];
        $props = $loopStruc['properties'][$i];

        // Push Data (guard against missing target keys)
        for ($i2=0; $i2 < 2; $i2++) {
            if (!isset($tgts[$i2][$ids[$i2]])) {
                // initialize missing target entry to avoid notices
                $tgts[$i2][$ids[$i2]] = [];
            }
            if (!isset($tgts[$i2][$ids[$i2]][$props[$i2]])) {
                $tgts[$i2][$ids[$i2]][$props[$i2]] = [];
            }
            $tgts[$i2][$ids[$i2]][$props[$i2]][] = $ids[1-$i2];
        }
    }
}

// Add Creations to Users
foreach ($newsletters as $id => $n) $users[$n['user_ID']]['creations'][] = $id;

// Put Data in Session
foreach (['newsletters' => &$newsletters, 'categories' => &$categories, 'users' => &$users] as $target => $data) $_SESSION[$target] = $data;