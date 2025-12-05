// Tutorial System
let currentTutorialStep = 0;
const totalSteps = 6;

function nextTutorialStep() {
    if (currentTutorialStep < totalSteps - 1) {
        document.querySelector(`[data-step="${currentTutorialStep}"]`).classList.remove('active');
        currentTutorialStep++;
        document.querySelector(`[data-step="${currentTutorialStep}"]`).classList.add('active');
    }
}

function prevTutorialStep() {
    if (currentTutorialStep > 0) {
        document.querySelector(`[data-step="${currentTutorialStep}"]`).classList.remove('active');
        currentTutorialStep--;
        document.querySelector(`[data-step="${currentTutorialStep}"]`).classList.add('active');
    }
}

function finishTutorial() {
    const overlay = document.getElementById('tutorialOverlay');
    overlay.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => {
        overlay.remove();
        // Send request to clear tutorial flag
        fetch('scripts/db/account/clear_tutorial.php', { method: 'POST' });
    }, 300);
}

// Initialize tutorial when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Skip tutorial button
    document.getElementById('skipTutorial')?.addEventListener('click', finishTutorial);
});
