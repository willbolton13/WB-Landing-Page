const CONTENTFUL_SPACE_ID = '61gxmoi51hte';
const CONTENTFUL_ACCESS_TOKEN = 'yhnd1CMUnXDBRbr5EcoHFyI_zWQ6INfhIOhQGs0H7MY';

document.addEventListener('DOMContentLoaded', function() {
    const locationSelect = document.getElementById('location-select');
    const heading = document.querySelector('.display-4');
    const originalHeadingText = heading.textContent;
    const promptText = document.querySelector('.location-prompt');
    const buttonsContainer = document.getElementById('buttons-container');
    const infoContainer = document.getElementById('info-container');

    /**
     * NEW: Fetches all locations from Contentful and populates the dropdown.
     */
    async function populateLocationDropdown() {
        const url = `https://cdn.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/master/entries?access_token=${CONTENTFUL_ACCESS_TOKEN}&content_type=location`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to load locations');
            const data = await response.json();

            data.items.sort((a, b) => a.fields.locationName.localeCompare(b.fields.locationName)); // Sort alphabetically

            data.items.forEach(location => {
                const option = document.createElement('option');
                option.value = location.fields.locationName;
                option.textContent = location.fields.locationName;
                locationSelect.appendChild(option);
            });

        } catch (error) {
            console.error("Error populating locations:", error);
        }
    }

    // Call the new function to fill the dropdown when the page loads
    populateLocationDropdown();

    lucide.createIcons();


    locationSelect.addEventListener('change', async function() {
        const selectedValue = this.value;

        heading.classList.add('is-fading-out');
        promptText?.classList.add('is-fading-out');
        buttonsContainer.style.opacity = 0;
        infoContainer.style.opacity = 0;

        await new Promise(resolve => setTimeout(resolve, 200));

        if (!selectedValue || this.selectedIndex === 0) {
            document.title = 'WaterBear Student Portal'; // Reset page title
            heading.innerHTML = originalHeadingText;
            promptText?.classList.remove('is-fading-out');
            buttonsContainer.innerHTML = '';
            infoContainer.innerHTML = '';
            heading.classList.remove('is-fading-out');
            lucide.createIcons(); // Re-render static icons if needed
            return;
        }

        const url = `https://cdn.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/master/entries?access_token=${CONTENTFUL_ACCESS_TOKEN}&content_type=location&fields.locationName=${selectedValue}&include=10`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            buttonsContainer.innerHTML = '';
            infoContainer.innerHTML = '';

            if (data.items.length > 0) {
                const location = data.items[0];
                const fields = location.fields;

                // NEW: Update the browser tab's title
                document.title = fields.pageTitle;
                heading.innerHTML = fields.pageTitle || originalHeadingText;
                promptText?.classList.add('is-fading-out');

                if (fields.locationButtons) {
                    const buttonHTML = fields.locationButtons.map(button => createPortalButtonHTML(button, data.includes.Entry)).join('');
                    buttonsContainer.innerHTML = `<div class="row g-4 location-content is-visible">${buttonHTML}</div>`;
                }

                if (fields.informationBlocks) {
                    const infoHTML = fields.informationBlocks.map((block, index) => createInfoBlockHTML(block, data.includes, index)).join('');
                    infoContainer.innerHTML = `<div class="location-content is-visible">${infoHTML}</div>`;
                }
            }

        } catch (error) {
            console.error('Error fetching data from Contentful:', error);
            infoContainer.innerHTML = '<p class="text-center">Sorry, we could not load the content right now.</p>';
        }

        heading.classList.remove('is-fading-out');
        buttonsContainer.style.opacity = 1;
        infoContainer.style.opacity = 1;
        lucide.createIcons(); // Render all icons, static and dynamic
    });
});

function createPortalButtonHTML(buttonLink, entries) {
    const buttonId = buttonLink.sys.id;
    const button = entries.find(entry => entry.sys.id === buttonId);
    if (!button) return '';
    const { buttonText, link, icon } = button.fields;
    
    const iconHTML = icon.startsWith('bi-') 
        ? `<i class="bi ${icon}"></i>`
        : `<i data-lucide="${icon}"></i>`;

    return `
        <div class="col-lg-3 col-md-6">
            <a href="${link}" target="_blank" class="portal-card portal-card-green">
                <div class="portal-card-icon">
                    ${iconHTML}
                </div>
                <h3>${buttonText}</h3>
            </a>
        </div>
    `;
}

function createInfoBlockHTML(blockLink, includes, index) {
    const blockId = blockLink.sys.id;
    const block = includes.Entry.find(entry => entry.sys.id === blockId);
    if (!block) return '';
    
    // Get the new button fields, along with the existing ones
    const { heading, content, image, buttonText, buttonLink } = block.fields;
    
    // --- Find the image URL ---
    const imageId = image?.sys.id;
    const imageAsset = imageId ? includes.Asset.find(asset => asset.sys.id === imageId) : null;
    const imageUrl = imageAsset ? `https:${imageAsset.fields.file.url}` : 'https://placehold.co/600x400';

    // --- Convert rich text to HTML ---
    const contentHTML = content.content.map(node => 
        node.content.map(innerNode => innerNode.value).join('')
    ).join('<br>');

    // --- NEW: Conditionally create the button ---
    let buttonHTML = ''; // Default to an empty string
    if (buttonText && buttonLink) {
        // If button text and a link exist in Contentful, create the button HTML
        buttonHTML = `<a href="${buttonLink}" target="_blank" class="overlap-btn">${buttonText}</a>`;
    }

    // Alternate layout based on index
    const layoutClass = index % 2 === 1 ? 'image-left' : '';

    return `
        <div class="content-block ${layoutClass}">
            <div class="row align-items-center">
                <div class="col-md-7 content-block-text">
                    <h2>${heading}</h2>
                    <p>${contentHTML}</p>
                </div>
                <div class="col-md-5 content-block-image">
                    <img src="${imageUrl}" class="img-fluid rounded" alt="${heading}">
                    ${buttonHTML} 
                </div>
            </div>
        </div>
    `;
}



