document.addEventListener('DOMContentLoaded', function() {
    const locationSelect = document.getElementById('location-select');
    const allContent = document.querySelectorAll('.location-content');
    const heading = document.querySelector('.display-4');
    const originalHeadingText = heading.textContent;
    const promptText = document.querySelector('.location-prompt');

    locationSelect.addEventListener('change', function() {
        const selectedValue = this.value;

        // Hide all dynamic blocks
        allContent.forEach(content => {
            content.classList.remove('is-visible');
        });
        
        // Fade out text
        heading.classList.add('is-fading-out');
        if (promptText) {
            promptText.classList.add('is-fading-out');
        }

        setTimeout(() => {
            if (selectedValue) {
                // Update heading
                const locationName = selectedValue.charAt(0).toUpperCase() + selectedValue.slice(1);
                heading.innerHTML = `WELCOME, <span class="location-name">${locationName}</span> STUDENTS`;

                // Find and show the correct button and info blocks
                const selectedButtons = document.getElementById(selectedValue + '-buttons');
                const selectedInfo = document.getElementById(selectedValue + '-info');

                if (selectedButtons) selectedButtons.classList.add('is-visible');
                if (selectedInfo) selectedInfo.classList.add('is-visible');

            } else {
                // Revert heading
                heading.textContent = originalHeadingText;
                if (promptText) {
                    promptText.classList.remove('is-fading-out');
                }
            }

            // Fade in new text
            heading.classList.remove('is-fading-out');

        }, 200); 
    });
});