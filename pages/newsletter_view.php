<!doctype html>
<html lang="en">
<head>
  <base href="../">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="bootstrap-5.3.6-dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="styling/main.css">
  <title>Newsletter Generator - Moved</title>
  <style>
    .redirect-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .redirect-card {
      background: white;
      border-radius: 20px;
      padding: 3rem;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 600px;
      animation: slideIn 0.5s ease;
    }
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .redirect-icon {
      font-size: 4rem;
      color: #667eea;
      margin-bottom: 1.5rem;
    }
    .redirect-title {
      font-size: 2rem;
      font-weight: 700;
      color: #2d3748;
      margin-bottom: 1rem;
    }
    .redirect-text {
      font-size: 1.1rem;
      color: #718096;
      margin-bottom: 2rem;
      line-height: 1.6;
    }
    .redirect-btn {
      padding: 1rem 2rem;
      font-size: 1.1rem;
      font-weight: 600;
      border-radius: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      text-decoration: none;
      display: inline-block;
      transition: transform 0.2s;
    }
    .redirect-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
      color: white;
    }
    .countdown {
      font-size: 0.9rem;
      color: #a0aec0;
      margin-top: 1.5rem;
    }
  </style>
</head>
<body>
  <div class="redirect-container">
    <div class="redirect-card">
      <div class="redirect-icon">
        <i class="fas fa-rocket"></i>
      </div>
      <h1 class="redirect-title">Newsletter Generator Has Moved!</h1>
      <p class="redirect-text">
        The newsletter generation and editing features are now available in the <strong>Admin Panel</strong> for a better, more streamlined experience.
      </p>
      <a href="../pages/adminPanel.php" class="redirect-btn">
        <i class="fas fa-cog me-2"></i>Go to Admin Panel
      </a>
      <div class="countdown">
        Redirecting automatically in <span id="countdown">5</span> seconds...
      </div>
    </div>
  </div>

  <script>
    // Auto redirect after 5 seconds
    let seconds = 5;
    const countdownEl = document.getElementById('countdown');
    
    const interval = setInterval(() => {
      seconds--;
      countdownEl.textContent = seconds;
      
      if (seconds <= 0) {
        clearInterval(interval);
        window.location.href = '../pages/adminPanel.php';
      }
    }, 1000);
  </script>
  <script src="../scripts/js/theme.js"></script>
</body>
</html>
