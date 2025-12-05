<?php

session_start();


// Easier Access
$newsletters = &$_SESSION['newsletters'];
$categories  = &$_SESSION['categories'];
$users       = &$_SESSION['users'];


function search(string $query) {

    global $newsletters, $categories, $users;

    // Return if Empty or Null
    if (!isset($query) || !strlen($query)) return null;

    // Prep Results
    $results = [
        'newsletters' => [],  // Newsletters
        'categories' => [],   // Categories
        'users' => []         // Users/Creators
    ];


    // Format Query
    $query = strtolower(trim($query));
    
    $threshold = 5;

    // Split Search into Terms/Words
    $sTerms = array_filter(
        explode(' ', $query),              // Seperate Words
        fn($term) => !empty(trim($term))   // Remove Empty Terms
    );


    // Store Relevant Newsletters
    foreach ($newsletters as $id => $data) {
        // Check that Newsletter is Released
        if ($data['status'] == 'published') {
            $score = relevance($query, $sTerms, [$data['title'], $data['content'], $id]);
            if ($score >= $threshold) $results['newsletters'][] = [$id, $score];
        }
    }

    // Store Relevant Categories
    foreach ($categories as $id => $data) {
        $score = relevance($query, $sTerms, [$data['name'], $id]);
        if ($score >= $threshold) $results['categories'][] = [$id, $score];
    }

    // Store Relevant Creators
    foreach ($users as $id => $data) {
        $score = relevance($query, $sTerms, [$data['username'], $id]);
        if ($score >= $threshold) $results['users'][] = [$id, $score];
    }

    // Sort results by Score
    foreach ($results as &$type) usort($type, fn($a, $b) => $b[1] <=> $a[1]);
    unset($type); // IMPORTANT: Break the reference to avoid bugs

    
    // Check Result Count
    $rAmount = 0;
    foreach ($results as $type) $rAmount += count($type);

    if ($rAmount) {

        $_SESSION['searchData'] = [
            'amount'  => $rAmount,
            'results' => $results,
            'query'   => $query
        ];

    }
    else $_SESSION['searchData'] = null;
}



function relevance(string $query, array $qTerms, array $data) {

    $score   = 0;
    $weights = [5, 2, 1];

    // Check if Query Matches Data
    foreach ($data as $type => $text) {

        $weight = $weights[$type] ?? 1;
        $text = strtolower($text);
        $tScore = 0;

        // Split Text into Words
        $tWords = array_filter(
            explode(' ', $text),                 // Seperate Words
            fn($tWord) => !empty(trim($tWord))   // Remove Empty Entries
        );

        // Query Match or Appearance
        if      ($query == $text)                                       $tScore = $weight*20;
        else if (strpos($text, $query) !== false && strlen($query) > 3) $tScore = $weight*10;
        else {

            // Term Matching
            foreach($qTerms as $term) {

                $term = trim($term, '.,!?;:/|=');

                // Term Appearance
                if (preg_match('/\b' . preg_quote($term, '/') . '\b/i', $text)) {            // Term appears as Word
                    $tScore += $weight;
                    continue;
                } 
                else if (strpos($text, $term) !== false) {
                    $tScore += round($weight / (count($qTerms) * count($tWords)) * 5, 2);    // Term appears within Word
                    continue;
                }

                foreach ($tWords as $word) {

                    $found = 0;
                    $word = trim($word, '.,!?;:/|=');

                    // Word Similarity (for Typos)
                    $similarity = round(similar_text($term, $word) / max(strlen($term), strlen($word)), 2);
                    if ($similarity > 0.6) {
                        $tScore += round($weight * $similarity / (count($qTerms) * count($tWords)) * 2, 2);
                        $found++;
                    }

                    // Phonetic Match
                    if (metaphone($term) === metaphone($word)) {
                        $tScore += round($weight / (count($qTerms) * count($tWords)), 2);
                        $found++;
                    }

                    // Check next Term
                    if ($found) break;
                }
            }

        }

        // Overwrite Score if higher
        $score += $tScore;
    }

    return $score;
}

function truncateText($text, $maxLength = 200) {

    // Strip HTML tags
    $stripped = strip_tags($text);

    if (strlen($stripped) <= $maxLength) return $stripped;   // Return Full Text
    return substr($stripped, 0, $maxLength) . '...';         // Return Truncated
}


// Get old Data
$rData = isset($_SESSION['searchData']) ? $_SESSION['searchData'] : null;

// Get new Data on Query Mismatch
$query = isset($_GET['query']) ? $_GET['query'] : null;
if ($query) {

    search(str_replace('%20', ' ', $_GET['query']));
    $rData = $_SESSION['searchData'];
}
$query   = $rData['query'] ?? $query ?? null;
$results = $rData['results'] ?? null;
$rAmount = $rData['amount'] ?? null;

// Get Filter Settings
$filters = isset($_GET['filters']) ? json_encode($_GET['filters']) : null;