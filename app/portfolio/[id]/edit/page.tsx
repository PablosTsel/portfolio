'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { use } from 'react';
import { ref, getDownloadURL, uploadString } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export default function EditPortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portfolioHtml, setPortfolioHtml] = useState('');
  
  // Unwrap the params promise
  const { id } = use(params);

  useEffect(() => {
    const loadPortfolio = async () => {
      try {
        // Try to load from our API endpoint which handles Firebase Storage internally
        try {
          const response = await fetch(`/api/portfolio/${id}?version=index`);
          if (response.ok) {
            let html = await response.text();
            
            // Make text elements editable (but not section titles)
            // First, make all text elements editable
            let editableHtml = html.replace(/(<h1|<h2|<h3|<h4|<h5|<h6|<p|<span|<li|<td|<th)(\s|>)/g, 
              '$1 contenteditable="true" style="outline: none; cursor: text;"$2');
            
            // Then make section titles non-editable (looking for common section title patterns)
            editableHtml = editableHtml.replace(/contenteditable="true"([^>]*>)(About|Skills|Experience|Projects|Education|Contact|Portfolio|Services|Expertise|Work)/gi, 
              '$1$2');
            
            // Also remove contenteditable from navigation items and buttons
            editableHtml = editableHtml.replace(/(<nav[^>]*>[\s\S]*?<\/nav>)/gi, (match) => {
              return match.replace(/contenteditable="true" style="outline: none; cursor: text;"/g, '');
            });
            
            // Remove contenteditable from links
            editableHtml = editableHtml.replace(/(<a[^>]*)(contenteditable="true" style="outline: none; cursor: text;")([^>]*>)/g, '$1$3');
            
            // Make profile images clickable for upload
            editableHtml = editableHtml.replace(/(<img[^>]*class="[^"]*profile[^"]*"[^>]*)(>)/gi, 
              '$1 style="cursor: pointer;" onclick="window.uploadProfileImage(this)" title="Click to change profile picture"$2');
            
            // Also make hero avatar clickable for upload
            editableHtml = editableHtml.replace(/(<div[^>]*class="[^"]*hero-avatar[^"]*"[^>]*)(>)/gi, 
              '$1 style="cursor: pointer;" onclick="window.uploadProfileAvatar(this)" title="Click to add profile picture"$2');
            
            // Make project images clickable for upload
            editableHtml = editableHtml.replace(/(<div[^>]*class="[^"]*project-image[^"]*"[^>]*>[\s\S]*?<img[^>]*)(>)/gi, (match, imgStart) => {
              return match.replace(/<img([^>]*)>/gi, '<img$1 style="cursor: pointer;" onclick="window.uploadProjectImage(this)" title="Click to change project image">');
            });
            
            // Add all the CSS and scripts for editing
            const saveButtonStyles = `
              <style>
                .save-portfolio-btn {
                  position: fixed;
                  top: 80px;
                  right: 20px;
                  z-index: 9999;
                  background: linear-gradient(to right, #3b82f6, #9333ea);
                  color: white;
                  padding: 12px 24px;
                  border-radius: 8px;
                  border: none;
                  font-weight: 600;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                  transition: all 0.2s;
                }
                .save-portfolio-btn:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
                }
                .save-portfolio-btn:disabled {
                  opacity: 0.7;
                  cursor: not-allowed;
                }
                [contenteditable="true"]:hover {
                  background-color: rgba(59, 130, 246, 0.05);
                  border-radius: 4px;
                  transition: background-color 0.2s;
                }
                [contenteditable="true"]:focus {
                  background-color: rgba(59, 130, 246, 0.1);
                  border-radius: 4px;
                }
                
                /* Profile image upload indicators - ONLY for editing mode */
                .editing-mode .hero-avatar[onclick] {
                  position: relative;
                  border: 3px dashed rgba(59, 130, 246, 0.5);
                  transition: all 0.3s ease;
                }
                
                .editing-mode .hero-avatar[onclick]:hover {
                  border-color: rgba(59, 130, 246, 0.8);
                  transform: scale(1.02);
                  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
                }
                
                .editing-mode .hero-avatar[onclick]::after {
                  content: "\\1F4F7";
                  position: absolute;
                  bottom: 10%;
                  right: 10%;
                  background: #3b82f6;
                  color: white;
                  width: 40px;
                  height: 40px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 20px;
                  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                  transition: all 0.3s ease;
                }
                
                .editing-mode .hero-avatar[onclick]:hover::after {
                  transform: scale(1.1);
                  background: #2563eb;
                }
                
                .editing-mode img[onclick].profile-image {
                  position: relative;
                  transition: all 0.3s ease;
                  border: 3px solid transparent;
                }
                
                .editing-mode img[onclick].profile-image:hover {
                  transform: scale(1.02);
                  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
                  border-color: rgba(59, 130, 246, 0.5);
                }
                
                /* Add camera overlay on hover for existing images - ONLY for editing mode */
                .editing-mode .hero-image {
                  position: relative;
                }
                
                .editing-mode .hero-image::after {
                  content: "\\1F4F7 Change Photo";
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  background: rgba(0, 0, 0, 0.7);
                  color: white;
                  padding: 12px 20px;
                  border-radius: 8px;
                  font-size: 16px;
                  font-weight: 500;
                  opacity: 0;
                  transition: opacity 0.3s ease;
                  pointer-events: none;
                  white-space: nowrap;
                }
                
                .editing-mode .hero-image:hover::after {
                  opacity: 1;
                }
                
                /* Ensure the image container handles the hover properly - ONLY for editing mode */
                .editing-mode .hero-image:has(img[onclick]) {
                  cursor: pointer;
                }
                
                /* Project image upload indicators - ONLY for editing mode */
                .editing-mode .project-image {
                  position: relative;
                  overflow: hidden;
                }
                
                .editing-mode .project-image img[onclick] {
                  transition: all 0.3s ease;
                }
                
                .editing-mode .project-image:hover img[onclick] {
                  transform: scale(1.05);
                  filter: brightness(0.8);
                }
                
                .editing-mode .project-image::after {
                  content: "\\1F4F7 Change Image";
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  background: rgba(0, 0, 0, 0.7);
                  color: white;
                  padding: 10px 20px;
                  border-radius: 6px;
                  font-size: 14px;
                  font-weight: 500;
                  opacity: 0;
                  transition: opacity 0.3s ease;
                  pointer-events: none;
                  white-space: nowrap;
                  z-index: 10;
                }
                
                .editing-mode .project-image:hover::after {
                  opacity: 1;
                }
                
                .upload-overlay {
                  position: fixed;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: rgba(0, 0, 0, 0.5);
                  display: none;
                  justify-content: center;
                  align-items: center;
                  z-index: 10000;
                }
                .upload-modal {
                  background: white;
                  padding: 24px;
                  border-radius: 12px;
                  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                  max-width: 400px;
                  width: 90%;
                }
                .upload-modal h3 {
                  margin: 0 0 16px 0;
                  color: #1f2937;
                }
                .upload-modal input[type="file"] {
                  width: 100%;
                  padding: 8px;
                  border: 2px dashed #cbd5e1;
                  border-radius: 8px;
                  margin-bottom: 16px;
                }
                .upload-modal button {
                  padding: 8px 16px;
                  margin-right: 8px;
                  border-radius: 6px;
                  border: none;
                  cursor: pointer;
                  font-weight: 500;
                }
                .upload-modal button.primary {
                  background: #3b82f6;
                  color: white;
                }
                .upload-modal button.secondary {
                  background: #e5e7eb;
                  color: #374151;
                }
              </style>
            `;
            
            // Add save button and inject styles
            const saveButton = `
              <button id="save-portfolio" class="save-portfolio-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Save Portfolio
              </button>
            `;
            
            // Add profile upload script
            const uploadScript = `
              <script>
                let currentImageElement = null;
                
                // Add editing-mode class to body for styling
                document.body.classList.add('editing-mode');
                
                window.uploadProfileImage = function(imgElement) {
                  currentImageElement = imgElement;
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = function(e) {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = function(e) {
                        currentImageElement.src = e.target.result;
                        // Store the image data for saving later
                        currentImageElement.setAttribute('data-new-image', e.target.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  };
                  input.click();
                };
                
                window.uploadProfileAvatar = function(avatarDiv) {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = function(e) {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = function(e) {
                        // Create an img element to replace the avatar div
                        const img = document.createElement('img');
                        img.src = e.target.result;
                        img.alt = 'Profile';
                        img.className = 'profile-image';
                        img.style.cursor = 'pointer';
                        img.onclick = function() { window.uploadProfileImage(img); };
                        img.title = 'Click to change profile picture';
                        img.setAttribute('data-new-image', e.target.result);
                        
                        // Replace the avatar div with the image
                        avatarDiv.parentNode.replaceChild(img, avatarDiv);
                      };
                      reader.readAsDataURL(file);
                    }
                  };
                  input.click();
                };
                
                window.uploadProjectImage = function(imgElement) {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = function(e) {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = function(e) {
                        imgElement.src = e.target.result;
                        // Store the image data for saving later
                        imgElement.setAttribute('data-new-image', e.target.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  };
                  input.click();
                };
              </script>
            `;
            
            // Inject styles, button, and script before closing body tag
            editableHtml = editableHtml.replace('</head>', saveButtonStyles + '</head>');
            editableHtml = editableHtml.replace('</body>', saveButton + uploadScript + '</body>');
            
            setPortfolioHtml(editableHtml);
            setLoading(false);
            return;
          }
        } catch (existsError) {
          console.log('Portfolio does not exist in Firebase Storage:', existsError);
          throw new Error('Portfolio not found in Firebase Storage');
        }
      } catch (error) {
        console.error('Error loading portfolio:', error);
        router.push('/dashboard');
      }
    };

    loadPortfolio();
  }, [id, router]);

  const savePortfolio = async () => {
    setSaving(true);
    
    try {
      // Get the iframe document
      const iframe = document.getElementById('portfolio-iframe') as HTMLIFrameElement;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (iframeDoc) {
        // Remove editing-mode class to remove all editing styles
        iframeDoc.body.classList.remove('editing-mode');
        
        // Remove save button and contenteditable attributes for the final version
        const saveBtn = iframeDoc.getElementById('save-portfolio');
        if (saveBtn) saveBtn.remove();
        
        // Remove ALL editing-specific CSS styles
        const styleElements = iframeDoc.querySelectorAll('style');
        styleElements.forEach(styleEl => {
          const styleText = styleEl.textContent || '';
          // Remove all editing-related CSS rules
          const cleanedCSS = styleText
            .replace(/\.save-portfolio-btn[^}]*}/g, '') // Remove save button styles
            .replace(/\[contenteditable="true"\][^}]*}/g, '') // Remove contenteditable styles
            .replace(/\.editing-mode[^}]*}/g, '') // Remove all editing-mode styles
            .replace(/\.hero-avatar\[onclick\][^}]*}/g, '') // Remove onclick avatar styles
            .replace(/img\[onclick\]\.profile-image[^}]*}/g, '') // Remove onclick image styles
            .replace(/\.hero-image::after[^}]*}/g, '') // Remove hero image overlays
            .replace(/\.hero-image:hover::after[^}]*}/g, '') // Remove hover overlays
            .replace(/\.hero-image:has\(img\[onclick\]\)[^}]*}/g, '') // Remove has selector styles
            .replace(/\.project-image::after[^}]*}/g, '') // Remove project image overlays
            .replace(/\.project-image:hover[^}]*}/g, '') // Remove project image hover styles
            .replace(/\.upload-overlay[^}]*}/g, '') // Remove upload modal styles
            .replace(/\.upload-modal[^}]*}/g, ''); // Remove upload modal styles
          
          styleEl.textContent = cleanedCSS;
        });
        
        // Remove contenteditable attributes
        const editableElements = iframeDoc.querySelectorAll('[contenteditable="true"]');
        editableElements.forEach(el => {
          el.removeAttribute('contenteditable');
          // Only remove the style if it's our editing style
          const style = el.getAttribute('style');
          if (style === 'outline: none; cursor: text;') {
            el.removeAttribute('style');
          }
        });
        
        // Remove onclick handlers from images
        const clickableImages = iframeDoc.querySelectorAll('img[onclick], div[onclick]');
        clickableImages.forEach(el => {
          el.removeAttribute('onclick');
          el.removeAttribute('title');
          const htmlEl = el as HTMLElement;
          if (htmlEl.style.cursor === 'pointer') {
            htmlEl.style.cursor = '';
          }
        });
        
        // Remove the upload script entirely
        const scripts = iframeDoc.querySelectorAll('script');
        scripts.forEach(script => {
          const scriptText = script.textContent || '';
          if (scriptText.includes('uploadProfileImage') || scriptText.includes('editing-mode') || scriptText.includes('uploadProjectImage')) {
            script.remove();
          }
        });
        
        // Get the cleaned HTML
        const finalHtml = iframeDoc.documentElement.outerHTML;
        
        // Save directly to Firebase Storage
        const { ref, uploadString } = await import('firebase/storage');
        const { storage } = await import('@/lib/firebase');
        
        const finalRef = ref(storage, `portfolios/${id}/final.html`);
        await uploadString(finalRef, finalHtml, 'raw', {
          contentType: 'text/html',
        });
        
        // Redirect to the portfolio
        router.push(`/portfolio/${id}`);
      }
    } catch (error) {
      console.error('Error saving portfolio:', error);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    // Add save button click handler when iframe loads
    const handleIframeLoad = () => {
      const iframe = document.getElementById('portfolio-iframe') as HTMLIFrameElement;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (iframeDoc) {
        const saveBtn = iframeDoc.getElementById('save-portfolio');
        if (saveBtn) {
          saveBtn.onclick = savePortfolio;
        }
      }
    };
    
    const iframe = document.getElementById('portfolio-iframe');
    if (iframe) {
      iframe.addEventListener('load', handleIframeLoad);
    }
    
    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleIframeLoad);
      }
    };
  }, [portfolioHtml]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center">
            <Loader2 className="h-10 w-10 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <p className="text-slate-600 dark:text-slate-300">Loading portfolio editor...</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      id="portfolio-iframe"
      srcDoc={portfolioHtml}
      className="w-full h-screen border-0"
      title="Edit Portfolio"
    />
  );
} 