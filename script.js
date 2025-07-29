import { animate, inView } from "motion";

// Environment-based configuration with fallbacks
const CONFIG = {
    CONTENTFUL_SPACE_ID: window.ENV?.CONTENTFUL_SPACE_ID || '61gxmoi51hte',
    CONTENTFUL_ACCESS_TOKEN: window.ENV?.CONTENTFUL_ACCESS_TOKEN || 'yhnd1CMUnXDBRbr5EcoHFyI_zWQ6INfhIOhQGs0H7MY'
};

// Development mode check
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

function debugLog(...args) {
    if (isDevelopment) {
        console.log(...args);
    }
}

// Browser detection utility
const browserInfo = {
    isFirefox: navigator.userAgent.toLowerCase().indexOf('firefox') > -1,
    isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
    isChrome: /chrome/.test(navigator.userAgent.toLowerCase())
};

// Contentful API client with rate limiting
class ContentfulClient {
    constructor(spaceId, accessToken) {
        this.spaceId = spaceId;
        this.accessToken = accessToken;
        this.baseUrl = `https://cdn.contentful.com/spaces/${spaceId}/environments/master`;
        this.lastRequestTime = 0;
        this.requestQueue = [];
        this.isProcessingQueue = false;
    }

    async makeRequest(endpoint, params = {}) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ endpoint, params, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const { endpoint, params, resolve, reject } = this.requestQueue.shift();
            
            try {
                // Rate limiting: Contentful allows 78 requests/second, we'll use 20/second to be safe
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastRequestTime;
                const minInterval = 50; // 50ms = 20 requests per second

                if (timeSinceLastRequest < minInterval) {
                    await new Promise(res => setTimeout(res, minInterval - timeSinceLastRequest));
                }

                this.lastRequestTime = Date.now();

                const queryParams = new URLSearchParams({
                    access_token: this.accessToken,
                    ...params
                });

                const url = `${this.baseUrl}/${endpoint}?${queryParams}`;
                debugLog('Making Contentful request:', url);

                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                resolve(data);

            } catch (error) {
                console.error('Contentful API Error:', error);
                reject(new Error('Failed to load content. Please try again.'));
            }
        }

        this.isProcessingQueue = false;
    }

    async getLocations() {
        return this.makeRequest('entries', { content_type: 'location' });
    }

    async getLocationData(locationName) {
        return this.makeRequest('entries', {
            content_type: 'location',
            'fields.locationName': locationName,
            include: 10
        });
    }
}

// Content validation helpers
function validateContentfulResponse(data) {
    if (!data || !data.items || !Array.isArray(data.items)) {
        throw new Error('Invalid response format from Contentful');
    }
    
    if (data.items.length === 0) {
        throw new Error('No content found');
    }
    
    return data;
}

// Cross-browser animation helper
async function animateHeading(element, from, to) {
    if (from === to) return;
    
    if (browserInfo.isFirefox || browserInfo.isSafari) {
        // For Firefox and Safari, use a simpler approach
        element.style.transition = 'opacity 0.15s ease-out';
        element.style.opacity = '0';
        
        // Wait for the transition to complete
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Update content
        element.innerHTML = to;
        
        // Force reflow
        void element.offsetHeight;
        
        // Fade back in
        element.style.opacity = '1';
        
        // Cleanup after transition
        await new Promise(resolve => setTimeout(resolve, 150));
        element.style.transition = '';
    } else {
        // Use Motion One for Chrome and other browsers
        await animate(element, { opacity: 0 }, { duration: 0.15 }).finished;
        element.innerHTML = to;
        await animate(element, { opacity: 1 }, { duration: 0.2 }).finished;
    }
}

// Cross-browser content animation helper
async function animateContentOut(container1, container2) {
    // Motion One works fine for content fade out in all browsers
    await Promise.all([
        animate(container1, { opacity: 0 }, { duration: 0.3 }).finished,
        animate(container2, { opacity: 0 }, { duration: 0.3 }).finished
    ]);
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Contentful client
    const contentfulClient = new ContentfulClient(
        CONFIG.CONTENTFUL_SPACE_ID,
        CONFIG.CONTENTFUL_ACCESS_TOKEN
    );

    const locationSelect = document.getElementById('location-select');
    const heading = document.querySelector('.display-4');
    const originalHeadingText = heading.textContent;
    const buttonsContainer = document.getElementById('buttons-container');
    const infoContainer = document.getElementById('info-container');

    // Prevent animation on page load
    let isInitialLoad = true;

    async function populateLocationDropdown() {
        try {
            const data = await contentfulClient.getLocations();
            validateContentfulResponse(data);
            
            data.items.sort((a, b) => a.fields.locationName.localeCompare(b.fields.locationName));
            data.items.forEach(location => {
                const option = document.createElement('option');
                option.value = location.fields.locationName;
                option.textContent = location.fields.locationName;
                locationSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error populating locations:", error);
            locationSelect.innerHTML = '<option disabled>Unable to load locations</option>';
        }
    }

    async function loadLocationData(selectedValue) {
        try {
            const data = await contentfulClient.getLocationData(selectedValue);
            debugLog('Contentful data:', data);
            return validateContentfulResponse(data);
        } catch (error) {
            console.error('Error fetching data from Contentful:', error);
            throw error;
        }
    }

    function renderLocationContent(data, skipHeadingUpdate = false) {
        const location = data.items[0];
        const fields = location.fields;

        debugLog('Location data:', location);

        // Only update heading if not explicitly told to skip
        if (!skipHeadingUpdate) {
            document.title = fields.pageTitle || 'WaterBear Student Portal';
            heading.innerHTML = fields.pageTitle || originalHeadingText;
        }
        
        // Render buttons
        if (fields.locationButtons) {
            debugLog('Location buttons:', fields.locationButtons);
            debugLog('Includes entries:', data.includes.Entry);
            
            const buttonHTML = fields.locationButtons
                .map(button => {
                    const html = createPortalButtonHTML(button, data.includes.Entry);
                    debugLog('Generated button HTML:', html);
                    return html;
                })
                .filter(html => html)
                .join('');
            
            if (buttonHTML) {
                buttonsContainer.classList.add('location-content', 'is-visible');
                buttonsContainer.innerHTML = buttonHTML;
            }
        }

        // Render content blocks
        let contentHTML = '';
        
        if (fields.informationBlocks) {
            const infoHTML = fields.informationBlocks
                .map((block, index) => createInfoBlockHTML(block, data.includes, index))
                .filter(html => html)
                .join('');
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

    function setupAnimations() {
        setTimeout(() => {
            buttonsContainer.style.opacity = '1';
            
            // Animate dynamic buttons with Intersection Observer
            const dynamicButtons = buttonsContainer.querySelectorAll('.portal-card');
            if (dynamicButtons.length > 0) {
                setupElementAnimations(dynamicButtons);
            } else {
                animate(buttonsContainer, { opacity: [0, 1], y: [10, 0] }, { duration: 0.5, delay: 0.1 });
            }
            
            // Animate content blocks
            const blocks = infoContainer.querySelectorAll('.content-block, .staff-member');
            if (blocks.length > 0) {
                setupElementAnimations(blocks);
            }
        }, 200);
        
        infoContainer.style.opacity = '1';
    }

    function setupElementAnimations(elements) {
        // Set initial state
        elements.forEach((element) => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(30px)';
            element.style.transition = 'none';
        });
        
        // Create intersection observer
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const element = entry.target;
                    const index = Array.from(elements).indexOf(element);
                    
                    animate(element, 
                        { 
                            opacity: 1, 
                            transform: "translateY(0px)" 
                        }, 
                        { 
                            duration: 0.6, 
                            delay: index * 0.1
                        }
                    );
                    
                    observer.unobserve(element);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        
        elements.forEach(element => observer.observe(element));
    }

    // Initialize
    populateLocationDropdown();
    lucide.createIcons();
    // Reset dropdown to default state on page load
    locationSelect.selectedIndex = 0;
    
    // Ensure heading has no transitions on load
    heading.style.transition = 'none';
    setTimeout(() => {
        heading.style.transition = '';
    }, 100);
    
// Fixed location change event listener
    locationSelect.addEventListener('change', async function() {
        const selectedValue = this.value;
        const isResetting = !selectedValue || this.selectedIndex === 0 || selectedValue === "Choose your campus...";
        
        // Store current heading text to check if it actually changes
        const currentHeadingText = heading.innerHTML;
        
        // Animate content out (but not heading yet)
        await animateContentOut(buttonsContainer, infoContainer);

        // Clear content
        buttonsContainer.innerHTML = '';
        infoContainer.innerHTML = '';
        buttonsContainer.classList.remove('location-content', 'is-visible');

        if (isResetting) {
            document.title = 'WaterBear Student Portal';
            
            // Only animate heading if text is actually changing
            if (currentHeadingText !== originalHeadingText) {
                await animateHeading(heading, currentHeadingText, originalHeadingText);
            }
            
            lucide.createIcons();
            return;
        }

        try {
            const data = await loadLocationData(selectedValue);
            const location = data.items[0];
            const fields = location.fields;
            const newHeadingText = fields.pageTitle || originalHeadingText;
            
            // Update page title immediately (no flicker here)
            document.title = fields.pageTitle || 'WaterBear Student Portal';
            
            // Only animate heading if text is actually changing
            if (currentHeadingText !== newHeadingText) {
                await animateHeading(heading, currentHeadingText, newHeadingText);
            }
            
            // CRITICAL FIX: Pass true to skip heading update in renderLocationContent
            renderLocationContent(data, true);
            setupAnimations();
            
        } catch (error) {
            infoContainer.innerHTML = '<div class="alert alert-danger text-center">Sorry, we could not load the content right now. Please try again later.</div>';
            // No heading animation on error
        }
        
        lucide.createIcons();
    });

    function createPortalButtonHTML(buttonLink, entries) {
        const buttonId = buttonLink.sys.id;
        const button = entries.find(entry => entry.sys.id === buttonId);
        if (!button) return '';
        
        const { buttonText, link, icon, buttonSubtitle } = button.fields;
        
        debugLog('Processing button:', { buttonText, link, icon, buttonSubtitle });
        
        // Validate required fields
        if (!buttonText) {
            debugLog('Button missing buttonText:', button.fields);
            return '';
        }
        
        if (!link) {
            debugLog('Button missing link:', button.fields);
            return '';
        }
        
        const iconName = icon || 'square';
        const iconHTML = `<i data-lucide="${iconName}"></i>`;
        
        return `
            <div class="col-lg-6 col-md-6">
                <a href="${link}" target="_blank" rel="noopener noreferrer" class="portal-card portal-card-green">
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
            
            // Validate required fields
            if (!fullName || !jobTitle || !staffEmail) {
                debugLog('Staff member missing required fields:', { fullName, jobTitle, staffEmail });
                return '';
            }
            
            const photoId = photo?.sys.id;
            const photoAsset = photoId ? includes.Asset.find(asset => asset.sys.id === photoId) : null;
            const photoUrl = photoAsset ? `https:${photoAsset.fields.file.url}` : 
                `https://placehold.co/300x300/DE0029/FFFFFF?text=${encodeURIComponent(fullName.charAt(0))}`;
            
            return `
                <div class="col-lg-3 col-md-6 col-sm-12 mb-4">
                    <div class="staff-member">
                        <div class="staff-photo">
                            <img src="${photoUrl}" alt="${fullName}" class="img-fluid" loading="lazy">
                        </div>
                        <div class="staff-info">
                            <h4 class="staff-name">${fullName}</h4>
                            <p class="staff-title">${jobTitle}</p>
                            <a href="mailto:${staffEmail}" class="staff-email">${staffEmail}</a>
                        </div>
                    </div>
                </div>
            `;
        }).filter(html => html).join('');
        
        if (!staffHTML) return '';
        
        return `
            <div class="staff-section">
                <div class="section-divider" role="separator"></div>
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
        
        // Validate required fields
        if (!heading || !content) {
            debugLog('Info block missing required fields:', { heading, content });
            return '';
        }
        
        const imageId = image?.sys.id;
        const imageAsset = imageId ? includes.Asset.find(asset => asset.sys.id === imageId) : null;
        const imageUrl = imageAsset ? `https:${imageAsset.fields.file.url}` : 'https://placehold.co/600x400';
        
        const contentHTML = content.content.map(node => 
            node.content.map(innerNode => innerNode.value).join('')
        ).join('<br>');
        
        let buttonHTML = '';
        if (buttonText && buttonLink) {
            buttonHTML = `<a href="${buttonLink}" target="_blank" rel="noopener noreferrer" class="overlap-btn">${buttonText}</a>`;
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
                        <img src="${imageUrl}" class="img-fluid rounded" alt="${heading}" loading="lazy">
                        ${buttonHTML} 
                    </div>
                </div>
            </div>
        `;
    }
});