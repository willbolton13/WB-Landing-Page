import { animate, inView } from "motion";

const CONTENTFUL_SPACE_ID = '61gxmoi51hte';
const CONTENTFUL_ACCESS_TOKEN = 'yhnd1CMUnXDBRbr5EcoHFyI_zWQ6INfhIOhQGs0H7MY';

document.addEventListener('DOMContentLoaded', function() {
    // All variables and functions are now correctly inside the listener.
    const locationSelect = document.getElementById('location-select');
    const heading = document.querySelector('.display-4');
    const originalHeadingText = heading.textContent;
    const promptText = document.querySelector('.location-prompt');
    const buttonsContainer = document.getElementById('buttons-container');
    const infoContainer = document.getElementById('info-container');

    async function populateLocationDropdown() {
        const url = `https://cdn.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/master/entries?access_token=${CONTENTFUL_ACCESS_TOKEN}&content_type=location`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to load locations');
            const data = await response.json();
            data.items.sort((a, b) => a.fields.locationName.localeCompare(b.fields.locationName));
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

    populateLocationDropdown();
    lucide.createIcons();

    locationSelect.addEventListener('change', async function() {
        const selectedValue = this.value;

        // Animate content out first.
        await Promise.all([
            animate(heading, { opacity: 0 }, { duration: 0.3 }).finished,
            animate(buttonsContainer, { opacity: 0 }, { duration: 0.3 }).finished,
            animate(infoContainer, { opacity: 0 }, { duration: 0.3 }).finished
        ]);

        if (!selectedValue || this.selectedIndex === 0) {
            document.title = 'WaterBear Student Portal';
            heading.innerHTML = originalHeadingText;
            buttonsContainer.innerHTML = '';
            infoContainer.innerHTML = '';
            
            // Animate the original heading back in
            animate(heading, { opacity: 1 }, { duration: 0.4 });
            lucide.createIcons();
            return;
        }

        const url = `https://cdn.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/master/entries?access_token=${CONTENTFUL_ACCESS_TOKEN}&content_type=location&fields.locationName=${selectedValue}&include=10`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            // Add debugging
            console.log('Contentful data:', data);
            console.log('Location data:', data.items[0]);

            buttonsContainer.innerHTML = '';
            infoContainer.innerHTML = '';

            if (data.items.length > 0) {
                const location = data.items[0];
                const fields = location.fields;

                document.title = fields.pageTitle;
                heading.innerHTML = fields.pageTitle || originalHeadingText;
                
                if (fields.locationButtons) {
                    console.log('Location buttons:', fields.locationButtons);
                    console.log('Includes entries:', data.includes.Entry);
                    
                    const buttonHTML = fields.locationButtons.map(button => {
                        const html = createPortalButtonHTML(button, data.includes.Entry);
                        console.log('Generated button HTML:', html);
                        return html;
                    }).join('');
                    
                    // Add classes for styling/animation directly to the existing container
                    buttonsContainer.classList.add('location-content', 'is-visible'); 
                    // Inject only the columns, not another row
                    buttonsContainer.innerHTML = buttonHTML;
                }

                let contentHTML = '';
                
                if (fields.informationBlocks) {
                    const infoHTML = fields.informationBlocks.map((block, index) => createInfoBlockHTML(block, data.includes, index)).join('');
                    contentHTML += infoHTML;
                }
                
                if (fields.centreStaff) {
                    const staffHTML = createStaffSectionHTML(fields.centreStaff, data.includes);
                    contentHTML += staffHTML;
                }
                
                if (contentHTML) {
                    infoContainer.innerHTML = `<div class="location-content is-visible">${contentHTML}</div>`;
                }
            }
        } catch (error) {
            console.error('Error fetching data from Contentful:', error);
            console.error('Full error details:', error.message, error.stack);
            infoContainer.innerHTML = '<p class="text-center">Sorry, we could not load the content right now.</p>';
        }
        
        // Animate the new content back in.
        animate(heading, { opacity: 1 }, { duration: 0.4 });
        
        // Set up animations for both buttons and info content
        setTimeout(() => {
            // First, make sure the buttons container is visible
            buttonsContainer.style.opacity = '1';
            
            // Handle dynamic buttons with Intersection Observer (same as info blocks)
            const dynamicButtons = buttonsContainer.querySelectorAll('.portal-card');
            if (dynamicButtons.length > 0) {
                // Set initial state for buttons
                dynamicButtons.forEach((button, index) => {
                    button.style.opacity = '0';
                    button.style.transform = 'translateY(30px)';
                    button.style.transition = 'none';
                });
                
                // Create intersection observer for dynamic buttons
                const buttonObserver = new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            const button = entry.target;
                            const index = Array.from(dynamicButtons).indexOf(button);
                            
                            // Animate the button
                            animate(button, 
                                { 
                                    opacity: 1, 
                                    transform: "translateY(0px)" 
                                }, 
                                { 
                                    duration: 0.6, 
                                    delay: index * 0.1
                                }
                            );
                            
                            // Stop observing this element
                            buttonObserver.unobserve(button);
                        }
                    });
                }, {
                    threshold: 0.1,
                    rootMargin: '0px 0px -50px 0px'
                });
                
                // Start observing all buttons
                dynamicButtons.forEach(button => buttonObserver.observe(button));
                
            } else {
                // If no dynamic buttons, just animate the container
                animate(buttonsContainer, { opacity: [0, 1], y: [10, 0] }, { duration: 0.5, delay: 0.1 });
            }
            
            // Handle info content animations with Intersection Observer
            const blocks = infoContainer.querySelectorAll('.content-block, .staff-member');
            if (blocks.length > 0) {
                // Set initial state for all blocks
                blocks.forEach((block, index) => {
                    block.style.opacity = '0';
                    block.style.transform = 'translateY(30px)';
                    block.style.transition = 'none';
                });
                
                // Create intersection observer for info blocks
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            const block = entry.target;
                            const index = Array.from(blocks).indexOf(block);
                            
                            // Animate the block
                            animate(block, 
                                { 
                                    opacity: 1, 
                                    transform: "translateY(0px)" 
                                }, 
                                { 
                                    duration: 0.6, 
                                    delay: index * 0.1
                                }
                            );
                            
                            // Stop observing this element
                            observer.unobserve(block);
                        }
                    });
                }, {
                    threshold: 0.1,
                    rootMargin: '0px 0px -50px 0px'
                });
                
                // Start observing all blocks
                blocks.forEach(block => observer.observe(block));
            }
            
        }, 200);
        
        // Don't animate the info container itself - let the individual blocks handle their own animations
        // Just make sure the container is visible
        infoContainer.style.opacity = '1';
        
        lucide.createIcons();
    });

    function createPortalButtonHTML(buttonLink, entries) {
        const buttonId = buttonLink.sys.id;
        const button = entries.find(entry => entry.sys.id === buttonId);
        if (!button) return '';
        
        const { buttonText, link, icon, buttonSubtitle } = button.fields;
        
        // Log the button data for debugging
        console.log('Processing button:', { buttonText, link, icon, buttonSubtitle });
        
        // Check for missing required fields individually
        if (!buttonText) {
            console.warn('Button missing buttonText:', button.fields);
            return '';
        }
        
        if (!link) {
            console.warn('Button missing link:', button.fields);
            return '';
        }
        
        // Handle icon - default to 'square' if missing, and assume all icons are Lucide
        const iconName = icon || 'square';
        const iconHTML = `<i data-lucide="${iconName}"></i>`;
        
        return `
            <div class="col-lg-6 col-md-6">
                <a href="${link}" target="_blank" class="portal-card portal-card-green">
                    <div class="portal-card-icon">
                        ${iconHTML}
                    </div>
                    <h3>${buttonText}</h3>
                    <p class="portal-card-subtitle">${buttonSubtitle || ''}</p>
                </a>
            </div>
        `;
    }

    function createStaffSectionHTML(staffMembers, includes) {
        const staffHTML = staffMembers.map(memberLink => {
            const memberId = memberLink.sys.id;
            const member = includes.Entry.find(entry => entry.sys.id === memberId);
            if (!member) return '';
            
            const { fullName, jobTitle, staffEmail, photo } = member.fields;
            const photoId = photo?.sys.id;
            const photoAsset = photoId ? includes.Asset.find(asset => asset.sys.id === photoId) : null;
            const photoUrl = photoAsset ? `https:${photoAsset.fields.file.url}` : 'https://placehold.co/300x300/DE0029/FFFFFF?text=' + (fullName ? fullName.charAt(0) : '?');
            
            return `
                <div class="col-lg-3 col-md-6 col-sm-12 mb-4">
                    <div class="staff-member">
                        <div class="staff-photo">
                            <img src="${photoUrl}" alt="${fullName}" class="img-fluid">
                        </div>
                        <div class="staff-info">
                            <h4 class="staff-name">${fullName}</h4>
                            <p class="staff-title">${jobTitle}</p>
                            <a href="mailto:${staffEmail}" class="staff-email">${staffEmail}</a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="staff-section">
                <div class="section-divider"></div>
                <div class="row">
                    ${staffHTML}
                </div>
            </div>
        `;
    }

    function createInfoBlockHTML(blockLink, includes, index) {
        const blockId = blockLink.sys.id;
        const block = includes.Entry.find(entry => entry.sys.id === blockId);
        if (!block) return '';
        const { heading, content, image, buttonText, buttonLink } = block.fields;
        const imageId = image?.sys.id;
        const imageAsset = imageId ? includes.Asset.find(asset => asset.sys.id === imageId) : null;
        const imageUrl = imageAsset ? `https:${imageAsset.fields.file.url}` : 'https://placehold.co/600x400';
        const contentHTML = content.content.map(node => 
            node.content.map(innerNode => innerNode.value).join('')
        ).join('<br>');
        let buttonHTML = '';
        if (buttonText && buttonLink) {
            buttonHTML = `<a href="${buttonLink}" target="_blank" class="overlap-btn">${buttonText}</a>`;
        }
        const layoutClass = index % 2 === 1 ? 'image-left' : '';
        return `
            <div class="content-block ${layoutClass}">
                <div class="row align-items-center justify-content-between">
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
});