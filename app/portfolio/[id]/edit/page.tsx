'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { use } from 'react';
import { ref, getDownloadURL, uploadString, uploadBytes } from 'firebase/storage';
import { storage, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';

export default function EditPortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user } = useAuth();
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
          // First try the final version (published portfolio)
          const finalResponse = await fetch(`/api/portfolio/${id}?version=final`);
          if (finalResponse.ok) {
            let html = await finalResponse.text();
            
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
                
                /* Fix profile picture position */
                .hero-content {
                  display: grid !important;
                  grid-template-columns: 1fr 350px !important;
                  gap: 4rem !important;
                  align-items: center !important;
                  width: 100% !important;
                }
                
                .hero-image {
                  display: flex !important;
                  justify-content: center !important;
                  align-items: center !important;
                  width: 350px !important;
                  height: 350px !important;
                }
                
                /* Mobile responsive styles for profile picture fix */
                @media (max-width: 768px) {
                  .hero-content {
                    grid-template-columns: 1fr !important;
                    text-align: center !important;
                    gap: 2rem !important;
                  }
                  
                  .hero-image {
                    width: 100% !important;
                    height: auto !important;
                    justify-content: center !important;
                    margin-top: 2rem !important;
                  }
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
                
                /* Add Project Button - ONLY for editing mode */
                .editing-mode .add-project-btn {
                  display: flex !important;
                  align-items: center;
                  justify-content: center;
                  width: 60px;
                  height: 60px;
                  background: #3b82f6;
                  color: white;
                  border-radius: 50%;
                  border: none;
                  font-size: 28px;
                  cursor: pointer;
                  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                  transition: all 0.3s ease;
                  position: relative;
                  margin: auto;
                }
                
                .editing-mode .projects-grid {
                  position: relative;
                }
                
                .editing-mode .add-project-btn:hover {
                  background: #2563eb;
                  transform: scale(1.1);
                  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
                }
                
                .editing-mode .add-project-btn:active {
                  transform: scale(0.95);
                }
                
                /* Hide add project button when not in editing mode */
                .add-project-btn {
                  display: none !important;
                }
                
                /* Make add button container a proper grid item */
                .editing-mode .add-project-btn-container {
                  background: transparent;
                  border-radius: 12px;
                  overflow: hidden;
                  transition: transform 0.3s ease, box-shadow 0.3s ease;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 300px;
                  border: 2px dashed rgba(59, 130, 246, 0.3);
                }
                
                .editing-mode .add-project-btn-container:hover {
                  transform: translateY(-5px);
                  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                  border-color: rgba(59, 130, 246, 0.5);
                  background: rgba(59, 130, 246, 0.05);
                }
                
                /* New project card template */
                .new-project-card {
                  background: var(--card-bg);
                  border-radius: 12px;
                  overflow: hidden;
                  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                  transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                
                .new-project-card:hover {
                  transform: translateY(-5px);
                  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                }
                
                /* Add Skill Button - ONLY for editing mode */
                .editing-mode .add-skill-btn {
                  display: inline-flex !important;
                  align-items: center;
                  justify-content: center;
                  width: 40px;
                  height: 40px;
                  background: #3b82f6;
                  color: white;
                  border-radius: 50%;
                  border: none;
                  font-size: 20px;
                  cursor: pointer;
                  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                  transition: all 0.3s ease;
                  margin-left: 0.5rem;
                  vertical-align: middle;
                }
                
                .editing-mode .add-skill-btn:hover {
                  background: #2563eb;
                  transform: scale(1.1);
                  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                }
                
                .editing-mode .add-skill-btn:active {
                  transform: scale(0.95);
                }
                
                /* Hide add skill button when not in editing mode */
                .add-skill-btn {
                  display: none !important;
                }
                
                /* New skill tag styles */
                .editing-mode .skill-tag[contenteditable="true"] {
                  min-width: 80px;
                  display: inline-block;
                  background-color: var(--primary-color) !important;
                  color: white !important;
                }
                
                .editing-mode .skill-tag[contenteditable="true"]:focus {
                  background-color: var(--primary-color) !important;
                  color: white !important;
                  outline: 2px solid rgba(255, 255, 255, 0.5) !important;
                }
                
                /* Delete buttons - ONLY for editing mode */
                .editing-mode .skill-tag {
                  position: relative;
                }
                
                .editing-mode .delete-skill-btn {
                  position: absolute;
                  top: -8px;
                  right: -8px;
                  width: 20px;
                  height: 20px;
                  background: #ef4444 !important;
                  color: white !important;
                  border-radius: 50%;
                  border: none;
                  font-size: 12px;
                  font-weight: bold;
                  cursor: pointer;
                  display: flex !important;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                  transition: all 0.3s ease;
                  z-index: 1000 !important;
                  line-height: 1;
                }
                
                .editing-mode .delete-skill-btn:hover {
                  background: #dc2626 !important;
                  transform: scale(1.1);
                }
                
                .editing-mode .project-card {
                  position: relative;
                }
                
                .editing-mode .delete-project-btn {
                  position: absolute;
                  top: 10px;
                  right: 10px;
                  width: 30px;
                  height: 30px;
                  background: #ef4444 !important;
                  color: white !important;
                  border-radius: 50%;
                  border: none;
                  font-size: 16px;
                  font-weight: bold;
                  cursor: pointer;
                  display: flex !important;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                  transition: all 0.3s ease;
                  z-index: 1000 !important;
                  line-height: 1;
                }
                
                .editing-mode .delete-project-btn:hover {
                  background: #dc2626 !important;
                  transform: scale(1.1);
                }
                
                /* Hide delete buttons when not in editing mode */
                .delete-skill-btn, .delete-project-btn {
                  display: none !important;
                }
                
                /* Project edit buttons - ONLY for editing mode */
                .editing-mode .project-card {
                  position: relative;
                  padding-bottom: 60px !important; /* Add space for buttons */
                }
                
                .editing-mode .project-edit-buttons {
                  position: absolute;
                  bottom: 20px;
                  left: 1.5rem;
                  right: 1.5rem;
                  display: flex !important;
                  gap: 1rem;
                  z-index: 100;
                }
                
                .editing-mode .add-link-btn {
                  flex: 1;
                  padding: 8px 12px;
                  border-radius: 8px;
                  border: 2px dashed;
                  background: transparent;
                  cursor: pointer;
                  font-size: 14px;
                  font-weight: 500;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  transition: all 0.3s ease;
                  min-height: 36px;
                }
                
                .editing-mode .add-link-btn.report {
                  border-color: #3b82f6;
                  color: #3b82f6;
                  background-color: rgba(59, 130, 246, 0.05);
                }
                
                .editing-mode .add-link-btn.report:hover {
                  background-color: rgba(59, 130, 246, 0.1);
                  border-color: #2563eb;
                  color: #2563eb;
                  transform: translateY(-1px);
                  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
                }
                
                .editing-mode .add-link-btn.github {
                  border-color: #9333ea;
                  color: #9333ea;
                  background-color: rgba(147, 51, 234, 0.05);
                }
                
                .editing-mode .add-link-btn.github:hover {
                  background-color: rgba(147, 51, 234, 0.1);
                  border-color: #7c3aed;
                  color: #7c3aed;
                  transform: translateY(-1px);
                  box-shadow: 0 2px 8px rgba(147, 51, 234, 0.2);
                }
                
                /* Modify buttons have solid borders instead of dashed */
                .editing-mode .add-link-btn.modify {
                  border-style: solid !important;
                }
                
                /* Project links in final portfolio */
                .project-links {
                  position: absolute;
                  bottom: 20px;
                  left: 1.5rem;
                  right: 1.5rem;
                  display: flex;
                  gap: 1rem;
                  z-index: 100;
                }
                
                .project-link {
                  flex: 1;
                  padding: 8px 12px;
                  border-radius: 8px;
                  text-decoration: none;
                  font-size: 14px;
                  font-weight: 500;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  transition: all 0.3s ease;
                  min-height: 36px;
                  color: white;
                }
                
                .project-link.report {
                  background-color: #3b82f6;
                }
                
                .project-link.report:hover {
                  background-color: #2563eb;
                  transform: translateY(-1px);
                  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }
                
                .project-link.github {
                  background-color: #9333ea;
                }
                
                .project-link.github:hover {
                  background-color: #7c3aed;
                  transform: translateY(-1px);
                  box-shadow: 0 4px 12px rgba(147, 51, 234, 0.3);
                }
                
                /* Hide project edit buttons when not in editing mode */
                .project-edit-buttons {
                  display: none !important;
                }
                
                /* Hide existing project links when in editing mode */
                .editing-mode .project-links {
                  display: none !important;
                }
                
                /* Ensure project cards have proper spacing for links */
                .project-card {
                  position: relative; /* Ensure project links are positioned relative to the card */
                  padding-bottom: 80px; /* Space for links in final portfolio */
                }
                
                /* Font Awesome icons - ensure they're loaded */
                .fa, .fas, .fab {
                  font-family: "Font Awesome 5 Free", "Font Awesome 5 Brands";
                }
              </style>
            `;
            
            // Add save button and inject styles - change text to "Save Changes" for existing portfolios
            const saveButton = `
              <button id="save-portfolio" class="save-portfolio-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Save Changes
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
                
                // Add new project function
                window.addNewProject = function() {
                  const addButton = document.querySelector('.add-project-btn');
                  const addButtonContainer = addButton ? addButton.parentElement : null;
                  
                  if (addButtonContainer) {
                    // Create new project card
                    const newProjectCard = document.createElement('div');
                    newProjectCard.className = 'project-card';
                    newProjectCard.innerHTML = \`
                      <div class="project-image">
                        <img src="https://placehold.co/600x400/e2e8f0/1e293b?text=Project+Image" 
                             alt="New Project" 
                             class="project-img" 
                             style="cursor: pointer;" 
                             onclick="window.uploadProjectImage(this)" 
                             title="Click to upload project image">
                      </div>
                      <div class="project-info">
                        <h3 contenteditable="true" style="outline: none; cursor: text;">Project Name</h3>
                        <p contenteditable="true" style="outline: none; cursor: text;">Describe your project here. What did you build? What technologies did you use? What was the impact or outcome?</p>
                      </div>
                    \`;
                    
                    // Replace the button container with the new project card
                    addButtonContainer.parentNode.replaceChild(newProjectCard, addButtonContainer);
                    
                    // Re-add the button container after the new card
                    const projectsGrid = document.querySelector('.projects-grid');
                    projectsGrid.appendChild(addButtonContainer);
                    
                    // Add delete button to the new project
                    window.addDeleteButtonToProject(newProjectCard);
                    
                    // Add edit buttons to the new project
                    window.addEditButtonsToProject(newProjectCard);
                    
                    // Scroll to the new card
                    newProjectCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Focus on the project name for immediate editing
                    const projectName = newProjectCard.querySelector('h3');
                    if (projectName) {
                      projectName.focus();
                      // Select all text
                      const range = document.createRange();
                      range.selectNodeContents(projectName);
                      const selection = window.getSelection();
                      selection.removeAllRanges();
                      selection.addRange(range);
                    }
                  }
                };
                
                // Add new skill function
                window.addNewSkill = function() {
                  const addSkillBtn = document.querySelector('.add-skill-btn');
                  
                  if (addSkillBtn) {
                    // Create new skill tag
                    const newSkillTag = document.createElement('div');
                    newSkillTag.className = 'skill-tag';
                    newSkillTag.contentEditable = 'true';
                    newSkillTag.style.outline = 'none';
                    newSkillTag.style.cursor = 'text';
                    newSkillTag.textContent = 'New Skill';
                    
                    // Add event listener for Enter key
                    newSkillTag.addEventListener('keydown', function(e) {
                      if (e.key === 'Enter') {
                        e.preventDefault(); // Prevent new line
                        newSkillTag.blur(); // Finish editing
                      }
                    });
                    
                    // Insert the new skill before the button
                    addSkillBtn.parentNode.insertBefore(newSkillTag, addSkillBtn);
                    
                    // Add delete button to the new skill
                    window.addDeleteButtonToSkill(newSkillTag);
                    
                    // Focus on the new skill and select all text
                    newSkillTag.focus();
                    const range = document.createRange();
                    range.selectNodeContents(newSkillTag);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                  }
                };
                
                // Delete skill function
                window.deleteSkill = function(skillTag) {
                  if (confirm('Are you sure you want to delete this skill?')) {
                    skillTag.remove();
                  }
                };
                
                // Delete project function
                window.deleteProject = function(projectCard) {
                  if (confirm('Are you sure you want to delete this project?')) {
                    projectCard.remove();
                  }
                };
                
                // Add delete button to skill
                window.addDeleteButtonToSkill = function(skillTag) {
                  // Don't add if it already has one
                  if (skillTag.querySelector('.delete-skill-btn')) {
                    return;
                  }
                  
                  const deleteBtn = document.createElement('button');
                  deleteBtn.className = 'delete-skill-btn';
                  deleteBtn.innerHTML = '×';
                  deleteBtn.title = 'Delete skill';
                  deleteBtn.onclick = function(e) {
                    e.stopPropagation();
                    window.deleteSkill(skillTag);
                  };
                  
                  skillTag.appendChild(deleteBtn);
                };
                
                // Add delete button to project
                window.addDeleteButtonToProject = function(projectCard) {
                  // Don't add if it already has one
                  if (projectCard.querySelector('.delete-project-btn')) {
                    return;
                  }
                  
                  const deleteBtn = document.createElement('button');
                  deleteBtn.className = 'delete-project-btn';
                  deleteBtn.innerHTML = '×';
                  deleteBtn.title = 'Delete project';
                  deleteBtn.onclick = function(e) {
                    e.stopPropagation();
                    window.deleteProject(projectCard);
                  };
                  
                  projectCard.appendChild(deleteBtn);
                };
                
                // Add the Add Project button after DOM loads
                window.addEventListener('DOMContentLoaded', function() {
                  setTimeout(function() {
                    const projectsGrid = document.querySelector('.projects-grid');
                    if (projectsGrid && !document.querySelector('.add-project-btn')) {
                      // Create the button container as a grid item
                      const addProjectContainer = document.createElement('div');
                      addProjectContainer.className = 'add-project-btn-container';
                      
                      const addProjectButton = document.createElement('button');
                      addProjectButton.className = 'add-project-btn';
                      addProjectButton.onclick = window.addNewProject;
                      addProjectButton.title = 'Add new project';
                      addProjectButton.innerHTML = \`
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      \`;
                      
                      addProjectContainer.appendChild(addProjectButton);
                      projectsGrid.appendChild(addProjectContainer);
                    }
                    
                    // Add delete buttons to existing projects
                    const existingProjects = document.querySelectorAll('.project-card');
                    existingProjects.forEach(function(projectCard) {
                      window.addDeleteButtonToProject(projectCard);
                      window.addEditButtonsToProject(projectCard);
                    });
                    
                    // Add the Add Skill button
                    const skillsContainer = document.querySelector('.skills-container');
                    if (skillsContainer && !document.querySelector('.add-skill-btn')) {
                      const addSkillButton = document.createElement('button');
                      addSkillButton.className = 'add-skill-btn';
                      addSkillButton.onclick = window.addNewSkill;
                      addSkillButton.title = 'Add new skill';
                      addSkillButton.innerHTML = \`
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      \`;
                      
                      skillsContainer.appendChild(addSkillButton);
                      
                      // Add Enter key handling for existing skill tags and make them editable
                      const existingSkillTags = document.querySelectorAll('.skill-tag');
                      existingSkillTags.forEach(function(skillTag) {
                        // Make it editable if it's not already
                        if (!skillTag.hasAttribute('contenteditable')) {
                          skillTag.contentEditable = 'true';
                          skillTag.style.outline = 'none';
                          skillTag.style.cursor = 'text';
                        }
                        
                        skillTag.addEventListener('keydown', function(e) {
                          if (e.key === 'Enter') {
                            e.preventDefault(); // Prevent new line
                            skillTag.blur(); // Finish editing
                          }
                        });
                        
                        // Add delete button to each skill
                        window.addDeleteButtonToSkill(skillTag);
                      });
                    }
                  }, 100);
                });
                
                // Delete project function
                window.deleteProject = function(projectCard) {
                  if (confirm('Are you sure you want to delete this project?')) {
                    projectCard.remove();
                  }
                };
                
                // Store for pending file uploads
                window.pendingUploads = window.pendingUploads || [];
                
                // Add report function
                window.addReport = function(projectCard) {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf';
                  input.onchange = function(e) {
                    const file = e.target.files[0];
                    if (file) {
                      if (file.type !== 'application/pdf') {
                        alert('Please select a PDF file.');
                        return;
                      }
                      
                      // Store file for upload when saving
                      const projectId = projectCard.id || 'project-' + Date.now();
                      projectCard.id = projectId;
                      
                      window.pendingUploads.push({
                        type: 'report',
                        file: file,
                        projectId: projectId
                      });
                      
                      // Update or create the project-links container
                      let linksContainer = projectCard.querySelector('.project-links');
                      if (!linksContainer) {
                        linksContainer = document.createElement('div');
                        linksContainer.className = 'project-links';
                        projectCard.appendChild(linksContainer);
                      }
                      
                      // Remove existing report link if any
                      const existingReport = linksContainer.querySelector('.report');
                      if (existingReport) {
                        existingReport.remove();
                      }
                      
                      // Add new report link
                      linksContainer.insertAdjacentHTML('beforeend', \`
                        <div class="project-link report" data-pending="true">
                          <i class="fas fa-file-alt"></i>
                          View Report
                        </div>
                      \`);
                      
                      // Also update the edit button to show it's been added
                      const buttonsContainer = projectCard.querySelector('.project-edit-buttons');
                      const reportButton = buttonsContainer ? buttonsContainer.querySelector('.add-link-btn.report') : null;
                      
                      if (reportButton) {
                        const wasExisting = !!existingReport;
                        reportButton.innerHTML = \`
                            <i class="fas fa-file-alt"></i>
                          Report \${wasExisting ? 'Modified' : 'Added'} ✓
                        \`;
                        reportButton.style.borderColor = '#10b981';
                        reportButton.style.color = '#10b981';
                        reportButton.disabled = true;
                      }
                      
                      console.log('Report file added:', file.name);
                    }
                  };
                  input.click();
                };
                
                // Add GitHub function
                window.addGitHub = function(projectCard) {
                  // Check if modifying existing GitHub link
                  const existingLinks = projectCard.querySelector('.project-links');
                  const existingGitHub = existingLinks ? existingLinks.querySelector('.github') : null;
                  const isModifying = !!existingGitHub;
                  
                  const url = prompt(isModifying ? 'Enter new GitHub repository URL:' : 'Enter GitHub repository URL:');
                  if (url) {
                    // Basic GitHub URL validation
                    const githubRegex = /^https?:\\/\\/(www\\.)?github\\.com\\/[a-zA-Z0-9_-]+\\/[a-zA-Z0-9_-]+\\/?$/;
                    if (!githubRegex.test(url)) {
                      alert('Please enter a valid GitHub repository URL (e.g., https://github.com/username/repository)');
                      return;
                    }
                    
                    // Update or create the project-links container
                    let linksContainer = projectCard.querySelector('.project-links');
                    if (!linksContainer) {
                      linksContainer = document.createElement('div');
                      linksContainer.className = 'project-links';
                      projectCard.appendChild(linksContainer);
                    }
                    
                    // Remove existing GitHub link if any
                    const existingGitHub = linksContainer.querySelector('.github');
                    if (existingGitHub) {
                      existingGitHub.remove();
                    }
                    
                    // Add new GitHub link
                    linksContainer.insertAdjacentHTML('beforeend', \`
                        <a href="\${url}" target="_blank" class="project-link github">
                          <i class="fab fa-github"></i>
                          View Code
                        </a>
                    \`);
                    
                    // Also update the edit button to show it's been added
                    const buttonsContainer = projectCard.querySelector('.project-edit-buttons');
                    const githubButton = buttonsContainer ? buttonsContainer.querySelector('.add-link-btn.github') : null;
                    
                    if (githubButton) {
                      githubButton.innerHTML = \`
                        <i class="fab fa-github"></i>
                        GitHub \${isModifying ? 'Modified' : 'Added'} ✓
                      \`;
                      githubButton.style.borderColor = '#10b981';
                      githubButton.style.color = '#10b981';
                      githubButton.disabled = true;
                    }
                    
                    console.log('GitHub URL added:', url);
                  }
                };
                
                // Add edit buttons to project
                window.addEditButtonsToProject = function(projectCard) {
                  // Don't add if it already has them
                  if (projectCard.querySelector('.project-edit-buttons')) {
                    return;
                  }
                  
                  // Check if project already has links (they're hidden but still in DOM)
                  const existingLinks = projectCard.querySelector('.project-links');
                  const hasReport = existingLinks && existingLinks.querySelector('.report');
                  const hasGitHub = existingLinks && existingLinks.querySelector('.github');
                  
                  // In edit mode, always show Add/Modify buttons
                  // The existing project-links are hidden by CSS in editing mode
                  const buttonsHtml = \`
                    <div class="project-edit-buttons">
                      <button class="add-link-btn report\${hasReport ? ' modify' : ''}" onclick="window.addReport(this.closest('.project-card'))" title="\${hasReport ? 'Modify PDF report' : 'Add PDF report'}">
                          <i class="fas fa-file-alt"></i>
                        \${hasReport ? 'Modify Report' : 'Add Report'}
                        </button>
                      <button class="add-link-btn github\${hasGitHub ? ' modify' : ''}" onclick="window.addGitHub(this.closest('.project-card'))" title="\${hasGitHub ? 'Modify GitHub repository' : 'Add GitHub repository'}">
                          <i class="fab fa-github"></i>
                        \${hasGitHub ? 'Modify Code' : 'Add GitHub'}
                        </button>
                    </div>
                  \`;
                  
                  projectCard.insertAdjacentHTML('beforeend', buttonsHtml);
                };
              </script>
            `;
            
            // Inject styles, button, and script before closing body tag
            editableHtml = editableHtml.replace('</head>', saveButtonStyles + '</head>');
            editableHtml = editableHtml.replace('</body>', saveButton + uploadScript + '</body>');
            
            // Add Font Awesome CDN for icons
            editableHtml = editableHtml.replace('</head>', '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"></head>');
            
            setPortfolioHtml(editableHtml);
            setLoading(false);
            return;
          }
        } catch (finalError) {
          console.log('Final version not found, trying draft version:', finalError);
        }

        try {
          // If no final version, try the draft (index.html)
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
                
                /* Fix profile picture position */
                .hero-content {
                  display: grid !important;
                  grid-template-columns: 1fr 350px !important;
                  gap: 4rem !important;
                  align-items: center !important;
                  width: 100% !important;
                }
                
                .hero-image {
                  display: flex !important;
                  justify-content: center !important;
                  align-items: center !important;
                  width: 350px !important;
                  height: 350px !important;
                }
                
                /* Mobile responsive styles for profile picture fix */
                @media (max-width: 768px) {
                  .hero-content {
                    grid-template-columns: 1fr !important;
                    text-align: center !important;
                    gap: 2rem !important;
                  }
                  
                  .hero-image {
                    width: 100% !important;
                    height: auto !important;
                    justify-content: center !important;
                    margin-top: 2rem !important;
                  }
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
                
                /* Add Project Button - ONLY for editing mode */
                .editing-mode .add-project-btn {
                  display: flex !important;
                  align-items: center;
                  justify-content: center;
                  width: 60px;
                  height: 60px;
                  background: #3b82f6;
                  color: white;
                  border-radius: 50%;
                  border: none;
                  font-size: 28px;
                  cursor: pointer;
                  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                  transition: all 0.3s ease;
                  position: relative;
                  margin: auto;
                }
                
                .editing-mode .projects-grid {
                  position: relative;
                }
                
                .editing-mode .add-project-btn:hover {
                  background: #2563eb;
                  transform: scale(1.1);
                  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
                }
                
                .editing-mode .add-project-btn:active {
                  transform: scale(0.95);
                }
                
                /* Hide add project button when not in editing mode */
                .add-project-btn {
                  display: none !important;
                }
                
                /* Make add button container a proper grid item */
                .editing-mode .add-project-btn-container {
                  background: transparent;
                  border-radius: 12px;
                  overflow: hidden;
                  transition: transform 0.3s ease, box-shadow 0.3s ease;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 300px;
                  border: 2px dashed rgba(59, 130, 246, 0.3);
                }
                
                .editing-mode .add-project-btn-container:hover {
                  transform: translateY(-5px);
                  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                  border-color: rgba(59, 130, 246, 0.5);
                  background: rgba(59, 130, 246, 0.05);
                }
                
                /* New project card template */
                .new-project-card {
                  background: var(--card-bg);
                  border-radius: 12px;
                  overflow: hidden;
                  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                  transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                
                .new-project-card:hover {
                  transform: translateY(-5px);
                  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                }
                
                /* Add Skill Button - ONLY for editing mode */
                .editing-mode .add-skill-btn {
                  display: inline-flex !important;
                  align-items: center;
                  justify-content: center;
                  width: 40px;
                  height: 40px;
                  background: #3b82f6;
                  color: white;
                  border-radius: 50%;
                  border: none;
                  font-size: 20px;
                  cursor: pointer;
                  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                  transition: all 0.3s ease;
                  margin-left: 0.5rem;
                  vertical-align: middle;
                }
                
                .editing-mode .add-skill-btn:hover {
                  background: #2563eb;
                  transform: scale(1.1);
                  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                }
                
                .editing-mode .add-skill-btn:active {
                  transform: scale(0.95);
                }
                
                /* Hide add skill button when not in editing mode */
                .add-skill-btn {
                  display: none !important;
                }
                
                /* New skill tag styles */
                .editing-mode .skill-tag[contenteditable="true"] {
                  min-width: 80px;
                  display: inline-block;
                  background-color: var(--primary-color) !important;
                  color: white !important;
                }
                
                .editing-mode .skill-tag[contenteditable="true"]:focus {
                  background-color: var(--primary-color) !important;
                  color: white !important;
                  outline: 2px solid rgba(255, 255, 255, 0.5) !important;
                }
                
                /* Delete buttons - ONLY for editing mode */
                .editing-mode .skill-tag {
                  position: relative;
                }
                
                .editing-mode .delete-skill-btn {
                  position: absolute;
                  top: -8px;
                  right: -8px;
                  width: 20px;
                  height: 20px;
                  background: #ef4444 !important;
                  color: white !important;
                  border-radius: 50%;
                  border: none;
                  font-size: 12px;
                  font-weight: bold;
                  cursor: pointer;
                  display: flex !important;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                  transition: all 0.3s ease;
                  z-index: 1000 !important;
                  line-height: 1;
                }
                
                .editing-mode .delete-skill-btn:hover {
                  background: #dc2626 !important;
                  transform: scale(1.1);
                }
                
                .editing-mode .project-card {
                  position: relative;
                }
                
                .editing-mode .delete-project-btn {
                  position: absolute;
                  top: 10px;
                  right: 10px;
                  width: 30px;
                  height: 30px;
                  background: #ef4444 !important;
                  color: white !important;
                  border-radius: 50%;
                  border: none;
                  font-size: 16px;
                  font-weight: bold;
                  cursor: pointer;
                  display: flex !important;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                  transition: all 0.3s ease;
                  z-index: 1000 !important;
                  line-height: 1;
                }
                
                .editing-mode .delete-project-btn:hover {
                  background: #dc2626 !important;
                  transform: scale(1.1);
                }
                
                /* Hide delete buttons when not in editing mode */
                .delete-skill-btn, .delete-project-btn {
                  display: none !important;
                }
                
                /* Project edit buttons - ONLY for editing mode */
                .editing-mode .project-card {
                  position: relative;
                  padding-bottom: 60px !important; /* Add space for buttons */
                }
                
                .editing-mode .project-edit-buttons {
                  position: absolute;
                  bottom: 20px;
                  left: 1.5rem;
                  right: 1.5rem;
                  display: flex !important;
                  gap: 1rem;
                  z-index: 100;
                }
                
                .editing-mode .add-link-btn {
                  flex: 1;
                  padding: 8px 12px;
                  border-radius: 8px;
                  border: 2px dashed;
                  background: transparent;
                  cursor: pointer;
                  font-size: 14px;
                  font-weight: 500;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  transition: all 0.3s ease;
                  min-height: 36px;
                }
                
                .editing-mode .add-link-btn.report {
                  border-color: #3b82f6;
                  color: #3b82f6;
                  background-color: rgba(59, 130, 246, 0.05);
                }
                
                .editing-mode .add-link-btn.report:hover {
                  background-color: rgba(59, 130, 246, 0.1);
                  border-color: #2563eb;
                  color: #2563eb;
                  transform: translateY(-1px);
                  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
                }
                
                .editing-mode .add-link-btn.github {
                  border-color: #9333ea;
                  color: #9333ea;
                  background-color: rgba(147, 51, 234, 0.05);
                }
                
                .editing-mode .add-link-btn.github:hover {
                  background-color: rgba(147, 51, 234, 0.1);
                  border-color: #7c3aed;
                  color: #7c3aed;
                  transform: translateY(-1px);
                  box-shadow: 0 2px 8px rgba(147, 51, 234, 0.2);
                }
                
                /* Modify buttons have solid borders instead of dashed */
                .editing-mode .add-link-btn.modify {
                  border-style: solid !important;
                }
                
                /* Project links in final portfolio */
                .project-links {
                  position: absolute;
                  bottom: 20px;
                  left: 1.5rem;
                  right: 1.5rem;
                  display: flex;
                  gap: 1rem;
                  z-index: 100;
                }
                
                .project-link {
                  flex: 1;
                  padding: 8px 12px;
                  border-radius: 8px;
                  text-decoration: none;
                  font-size: 14px;
                  font-weight: 500;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  transition: all 0.3s ease;
                  min-height: 36px;
                  color: white;
                }
                
                .project-link.report {
                  background-color: #3b82f6;
                }
                
                .project-link.report:hover {
                  background-color: #2563eb;
                  transform: translateY(-1px);
                  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }
                
                .project-link.github {
                  background-color: #9333ea;
                }
                
                .project-link.github:hover {
                  background-color: #7c3aed;
                  transform: translateY(-1px);
                  box-shadow: 0 4px 12px rgba(147, 51, 234, 0.3);
                }
                
                /* Hide project edit buttons when not in editing mode */
                .project-edit-buttons {
                  display: none !important;
                }
                
                /* Hide existing project links when in editing mode */
                .editing-mode .project-links {
                  display: none !important;
                }
                
                /* Ensure project cards have proper spacing for links */
                .project-card {
                  position: relative; /* Ensure project links are positioned relative to the card */
                  padding-bottom: 80px; /* Space for links in final portfolio */
                }
                
                /* Font Awesome icons - ensure they're loaded */
                .fa, .fas, .fab {
                  font-family: "Font Awesome 5 Free", "Font Awesome 5 Brands";
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
                
                // Add new project function
                window.addNewProject = function() {
                  const addButton = document.querySelector('.add-project-btn');
                  const addButtonContainer = addButton ? addButton.parentElement : null;
                  
                  if (addButtonContainer) {
                    // Create new project card
                    const newProjectCard = document.createElement('div');
                    newProjectCard.className = 'project-card';
                    newProjectCard.innerHTML = \`
                      <div class="project-image">
                        <img src="https://placehold.co/600x400/e2e8f0/1e293b?text=Project+Image" 
                             alt="New Project" 
                             class="project-img" 
                             style="cursor: pointer;" 
                             onclick="window.uploadProjectImage(this)" 
                             title="Click to upload project image">
                      </div>
                      <div class="project-info">
                        <h3 contenteditable="true" style="outline: none; cursor: text;">Project Name</h3>
                        <p contenteditable="true" style="outline: none; cursor: text;">Describe your project here. What did you build? What technologies did you use? What was the impact or outcome?</p>
                      </div>
                    \`;
                    
                    // Replace the button container with the new project card
                    addButtonContainer.parentNode.replaceChild(newProjectCard, addButtonContainer);
                    
                    // Re-add the button container after the new card
                    const projectsGrid = document.querySelector('.projects-grid');
                    projectsGrid.appendChild(addButtonContainer);
                    
                    // Add delete button to the new project
                    window.addDeleteButtonToProject(newProjectCard);
                    
                    // Add edit buttons to the new project
                    window.addEditButtonsToProject(newProjectCard);
                    
                    // Scroll to the new card
                    newProjectCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Focus on the project name for immediate editing
                    const projectName = newProjectCard.querySelector('h3');
                    if (projectName) {
                      projectName.focus();
                      // Select all text
                      const range = document.createRange();
                      range.selectNodeContents(projectName);
                      const selection = window.getSelection();
                      selection.removeAllRanges();
                      selection.addRange(range);
                    }
                  }
                };
                
                // Add new skill function
                window.addNewSkill = function() {
                  const addSkillBtn = document.querySelector('.add-skill-btn');
                  
                  if (addSkillBtn) {
                    // Create new skill tag
                    const newSkillTag = document.createElement('div');
                    newSkillTag.className = 'skill-tag';
                    newSkillTag.contentEditable = 'true';
                    newSkillTag.style.outline = 'none';
                    newSkillTag.style.cursor = 'text';
                    newSkillTag.textContent = 'New Skill';
                    
                    // Add event listener for Enter key
                    newSkillTag.addEventListener('keydown', function(e) {
                      if (e.key === 'Enter') {
                        e.preventDefault(); // Prevent new line
                        newSkillTag.blur(); // Finish editing
                      }
                    });
                    
                    // Insert the new skill before the button
                    addSkillBtn.parentNode.insertBefore(newSkillTag, addSkillBtn);
                    
                    // Add delete button to the new skill
                    window.addDeleteButtonToSkill(newSkillTag);
                    
                    // Focus on the new skill and select all text
                    newSkillTag.focus();
                    const range = document.createRange();
                    range.selectNodeContents(newSkillTag);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                  }
                };
                
                // Delete skill function
                window.deleteSkill = function(skillTag) {
                  if (confirm('Are you sure you want to delete this skill?')) {
                    skillTag.remove();
                  }
                };
                
                // Delete project function
                window.deleteProject = function(projectCard) {
                  if (confirm('Are you sure you want to delete this project?')) {
                    projectCard.remove();
                  }
                };
                
                // Add delete button to skill
                window.addDeleteButtonToSkill = function(skillTag) {
                  // Don't add if it already has one
                  if (skillTag.querySelector('.delete-skill-btn')) {
                    return;
                  }
                  
                  const deleteBtn = document.createElement('button');
                  deleteBtn.className = 'delete-skill-btn';
                  deleteBtn.innerHTML = '×';
                  deleteBtn.title = 'Delete skill';
                  deleteBtn.onclick = function(e) {
                    e.stopPropagation();
                    window.deleteSkill(skillTag);
                  };
                  
                  skillTag.appendChild(deleteBtn);
                };
                
                // Add delete button to project
                window.addDeleteButtonToProject = function(projectCard) {
                  // Don't add if it already has one
                  if (projectCard.querySelector('.delete-project-btn')) {
                    return;
                  }
                  
                  const deleteBtn = document.createElement('button');
                  deleteBtn.className = 'delete-project-btn';
                  deleteBtn.innerHTML = '×';
                  deleteBtn.title = 'Delete project';
                  deleteBtn.onclick = function(e) {
                    e.stopPropagation();
                    window.deleteProject(projectCard);
                  };
                  
                  projectCard.appendChild(deleteBtn);
                };
                
                // Add the Add Project button after DOM loads
                window.addEventListener('DOMContentLoaded', function() {
                  setTimeout(function() {
                    const projectsGrid = document.querySelector('.projects-grid');
                    if (projectsGrid && !document.querySelector('.add-project-btn')) {
                      // Create the button container as a grid item
                      const addProjectContainer = document.createElement('div');
                      addProjectContainer.className = 'add-project-btn-container';
                      
                      const addProjectButton = document.createElement('button');
                      addProjectButton.className = 'add-project-btn';
                      addProjectButton.onclick = window.addNewProject;
                      addProjectButton.title = 'Add new project';
                      addProjectButton.innerHTML = \`
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      \`;
                      
                      addProjectContainer.appendChild(addProjectButton);
                      projectsGrid.appendChild(addProjectContainer);
                    }
                    
                    // Add delete buttons to existing projects
                    const existingProjects = document.querySelectorAll('.project-card');
                    existingProjects.forEach(function(projectCard) {
                      window.addDeleteButtonToProject(projectCard);
                      window.addEditButtonsToProject(projectCard);
                    });
                    
                    // Add the Add Skill button
                    const skillsContainer = document.querySelector('.skills-container');
                    if (skillsContainer && !document.querySelector('.add-skill-btn')) {
                      const addSkillButton = document.createElement('button');
                      addSkillButton.className = 'add-skill-btn';
                      addSkillButton.onclick = window.addNewSkill;
                      addSkillButton.title = 'Add new skill';
                      addSkillButton.innerHTML = \`
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      \`;
                      
                      skillsContainer.appendChild(addSkillButton);
                      
                      // Add Enter key handling for existing skill tags and make them editable
                      const existingSkillTags = document.querySelectorAll('.skill-tag');
                      existingSkillTags.forEach(function(skillTag) {
                        // Make it editable if it's not already
                        if (!skillTag.hasAttribute('contenteditable')) {
                          skillTag.contentEditable = 'true';
                          skillTag.style.outline = 'none';
                          skillTag.style.cursor = 'text';
                        }
                        
                        skillTag.addEventListener('keydown', function(e) {
                          if (e.key === 'Enter') {
                            e.preventDefault(); // Prevent new line
                            skillTag.blur(); // Finish editing
                          }
                        });
                        
                        // Add delete button to each skill
                        window.addDeleteButtonToSkill(skillTag);
                      });
                    }
                  }, 100);
                });
                
                // Delete project function
                window.deleteProject = function(projectCard) {
                  if (confirm('Are you sure you want to delete this project?')) {
                    projectCard.remove();
                  }
                };
                
                // Store for pending file uploads
                window.pendingUploads = window.pendingUploads || [];
                
                // Add report function
                window.addReport = function(projectCard) {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf';
                  input.onchange = function(e) {
                    const file = e.target.files[0];
                    if (file) {
                      if (file.type !== 'application/pdf') {
                        alert('Please select a PDF file.');
                        return;
                      }
                      
                      // Store file for upload when saving
                      const projectId = projectCard.id || 'project-' + Date.now();
                      projectCard.id = projectId;
                      
                      window.pendingUploads.push({
                        type: 'report',
                        file: file,
                        projectId: projectId
                      });
                      
                      // Update or create the project-links container
                      let linksContainer = projectCard.querySelector('.project-links');
                      if (!linksContainer) {
                        linksContainer = document.createElement('div');
                        linksContainer.className = 'project-links';
                        projectCard.appendChild(linksContainer);
                      }
                      
                      // Remove existing report link if any
                      const existingReport = linksContainer.querySelector('.report');
                      if (existingReport) {
                        existingReport.remove();
                      }
                      
                      // Add new report link
                      linksContainer.insertAdjacentHTML('beforeend', \`
                        <div class="project-link report" data-pending="true">
                          <i class="fas fa-file-alt"></i>
                          View Report
                        </div>
                      \`);
                      
                      // Also update the edit button to show it's been added
                      const buttonsContainer = projectCard.querySelector('.project-edit-buttons');
                      const reportButton = buttonsContainer ? buttonsContainer.querySelector('.add-link-btn.report') : null;
                      
                      if (reportButton) {
                        const wasExisting = !!existingReport;
                        reportButton.innerHTML = \`
                            <i class="fas fa-file-alt"></i>
                          Report \${wasExisting ? 'Modified' : 'Added'} ✓
                        \`;
                        reportButton.style.borderColor = '#10b981';
                        reportButton.style.color = '#10b981';
                        reportButton.disabled = true;
                      }
                      
                      console.log('Report file added:', file.name);
                    }
                  };
                  input.click();
                };
                
                // Add GitHub function
                window.addGitHub = function(projectCard) {
                  // Check if modifying existing GitHub link
                  const existingLinks = projectCard.querySelector('.project-links');
                  const existingGitHub = existingLinks ? existingLinks.querySelector('.github') : null;
                  const isModifying = !!existingGitHub;
                  
                  const url = prompt(isModifying ? 'Enter new GitHub repository URL:' : 'Enter GitHub repository URL:');
                  if (url) {
                    // Basic GitHub URL validation
                    const githubRegex = /^https?:\\/\\/(www\\.)?github\\.com\\/[a-zA-Z0-9_-]+\\/[a-zA-Z0-9_-]+\\/?$/;
                    if (!githubRegex.test(url)) {
                      alert('Please enter a valid GitHub repository URL (e.g., https://github.com/username/repository)');
                      return;
                    }
                    
                    // Update or create the project-links container
                    let linksContainer = projectCard.querySelector('.project-links');
                    if (!linksContainer) {
                      linksContainer = document.createElement('div');
                      linksContainer.className = 'project-links';
                      projectCard.appendChild(linksContainer);
                    }
                    
                    // Remove existing GitHub link if any
                    const existingGitHub = linksContainer.querySelector('.github');
                    if (existingGitHub) {
                      existingGitHub.remove();
                    }
                    
                    // Add new GitHub link
                    linksContainer.insertAdjacentHTML('beforeend', \`
                        <a href="\${url}" target="_blank" class="project-link github">
                          <i class="fab fa-github"></i>
                          View Code
                        </a>
                    \`);
                    
                    // Also update the edit button to show it's been added
                    const buttonsContainer = projectCard.querySelector('.project-edit-buttons');
                    const githubButton = buttonsContainer ? buttonsContainer.querySelector('.add-link-btn.github') : null;
                    
                    if (githubButton) {
                      githubButton.innerHTML = \`
                        <i class="fab fa-github"></i>
                        GitHub \${isModifying ? 'Modified' : 'Added'} ✓
                      \`;
                      githubButton.style.borderColor = '#10b981';
                      githubButton.style.color = '#10b981';
                      githubButton.disabled = true;
                    }
                    
                    console.log('GitHub URL added:', url);
                  }
                };
                
                // Add edit buttons to project
                window.addEditButtonsToProject = function(projectCard) {
                  // Don't add if it already has them
                  if (projectCard.querySelector('.project-edit-buttons')) {
                    return;
                  }
                  
                  // Check if project already has links (they're hidden but still in DOM)
                  const existingLinks = projectCard.querySelector('.project-links');
                  const hasReport = existingLinks && existingLinks.querySelector('.report');
                  const hasGitHub = existingLinks && existingLinks.querySelector('.github');
                  
                  // In edit mode, always show Add/Modify buttons
                  // The existing project-links are hidden by CSS in editing mode
                  const buttonsHtml = \`
                    <div class="project-edit-buttons">
                      <button class="add-link-btn report\${hasReport ? ' modify' : ''}" onclick="window.addReport(this.closest('.project-card'))" title="\${hasReport ? 'Modify PDF report' : 'Add PDF report'}">
                          <i class="fas fa-file-alt"></i>
                        \${hasReport ? 'Modify Report' : 'Add Report'}
                        </button>
                      <button class="add-link-btn github\${hasGitHub ? ' modify' : ''}" onclick="window.addGitHub(this.closest('.project-card'))" title="\${hasGitHub ? 'Modify GitHub repository' : 'Add GitHub repository'}">
                          <i class="fab fa-github"></i>
                        \${hasGitHub ? 'Modify Code' : 'Add GitHub'}
                        </button>
                    </div>
                  \`;
                  
                  projectCard.insertAdjacentHTML('beforeend', buttonsHtml);
                };
              </script>
            `;
            
            // Inject styles, button, and script before closing body tag
            editableHtml = editableHtml.replace('</head>', saveButtonStyles + '</head>');
            editableHtml = editableHtml.replace('</body>', saveButton + uploadScript + '</body>');
            
            // Add Font Awesome CDN for icons
            editableHtml = editableHtml.replace('</head>', '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"></head>');
            
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
        // Extract portfolio title from the HTML for the dashboard
        let portfolioTitle = 'My Portfolio';
        const h1Elements = iframeDoc.querySelectorAll('h1');
        if (h1Elements.length > 0) {
          // Get the first h1 that contains actual name/title
          for (const h1 of h1Elements) {
            const text = h1.textContent?.trim() || '';
            // Skip navigation or section titles
            if (text && !text.toLowerCase().includes('portfolio') && text.length > 2) {
              portfolioTitle = text;
              break;
            }
          }
        }
        
        // Remove editing-mode class to remove all editing styles
        iframeDoc.body.classList.remove('editing-mode');
        
        // Remove save button and contenteditable attributes for the final version
        const saveBtn = iframeDoc.getElementById('save-portfolio');
        if (saveBtn) saveBtn.remove();
        
        // Remove add project button container
        const addProjectBtnContainer = iframeDoc.querySelector('.add-project-btn-container');
        if (addProjectBtnContainer) addProjectBtnContainer.remove();
        
        // Remove add project button (in case it exists without container)
        const addProjectBtn = iframeDoc.querySelector('.add-project-btn');
        if (addProjectBtn) addProjectBtn.remove();
        
        // Remove add skill button
        const addSkillBtn = iframeDoc.querySelector('.add-skill-btn');
        if (addSkillBtn) addSkillBtn.remove();
        
        // Remove all delete buttons
        const deleteSkillBtns = iframeDoc.querySelectorAll('.delete-skill-btn');
        deleteSkillBtns.forEach(btn => btn.remove());
        
        const deleteProjectBtns = iframeDoc.querySelectorAll('.delete-project-btn');
        deleteProjectBtns.forEach(btn => btn.remove());
        
        // Convert project edit buttons to final project links
        const projectEditButtons = iframeDoc.querySelectorAll('.project-edit-buttons');
        projectEditButtons.forEach(container => {
          // Remove only the add buttons, keep the view links
          const addButtons = container.querySelectorAll('.add-link-btn');
          addButtons.forEach(btn => btn.remove());
          
          // If there are any remaining links (View Code, View Report), convert the container to project-links
          const remainingLinks = container.querySelectorAll('.project-link, a.project-link');
          if (remainingLinks.length > 0) {
            // Change class from project-edit-buttons to project-links
            container.classList.remove('project-edit-buttons');
            container.classList.add('project-links');
          } else {
            // If no links remain, remove the container entirely
            container.remove();
          }
        });
        
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
            .replace(/\.upload-modal[^}]*}/g, '') // Remove upload modal styles
            .replace(/\.add-project-btn[^}]*}/g, '') // Remove add project button styles
            .replace(/\.add-project-btn-container[^}]*}/g, '') // Remove add button container styles
            .replace(/\.new-project-card[^}]*}/g, '') // Remove new project card styles
            .replace(/\.add-skill-btn[^}]*}/g, '') // Remove add skill button styles
            .replace(/\.project-edit-buttons[^}]*}/g, '') // Remove project edit buttons
            .replace(/\.add-link-btn[^}]*}/g, '') // Remove add link button styles
            .replace(/\.delete-skill-btn[^}]*}/g, '') // Remove delete skill button styles
            .replace(/\.delete-project-btn[^}]*}/g, ''); // Remove delete project button styles
          
          styleEl.textContent = cleanedCSS;
        });
        
        // Handle pending file uploads before cleaning the DOM
        const iframe = document.getElementById('portfolio-iframe') as HTMLIFrameElement;
        const iframeWindow = iframe.contentWindow;
        const pendingUploads = iframeWindow ? (iframeWindow as any).pendingUploads || [] : [];
        
        // Upload PDF files to Firebase Storage
        if (pendingUploads.length > 0 && user) {
          const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
          const { storage } = await import('@/lib/firebase');
          
          for (const upload of pendingUploads) {
            if (upload.type === 'report' && upload.file) {
              try {
                const reportRef = ref(storage, `users/${user.uid}/portfolios/${id}/reports/${upload.projectId}.pdf`);
                await uploadBytes(reportRef, upload.file);
                const downloadURL = await getDownloadURL(reportRef);
                
                // Update the project link with the actual URL
                const projectCard = iframeDoc.getElementById(upload.projectId);
                if (projectCard) {
                  const reportLink = projectCard.querySelector('.project-link.report');
                  if (reportLink && reportLink.tagName !== 'A') {
                    // Convert div to link
                    reportLink.outerHTML = `
                      <a href="${downloadURL}" target="_blank" class="project-link report">
                        <i class="fas fa-file-alt"></i>
                        View Report
                      </a>
                    `;
                  }
                }
                
                console.log('Report uploaded successfully:', downloadURL);
              } catch (error) {
                console.error('Error uploading report:', error);
                // Remove the report link if upload failed
                const projectCard = iframeDoc.getElementById(upload.projectId);
                if (projectCard) {
                  const reportLink = projectCard.querySelector('.project-link.report');
                  if (reportLink) reportLink.remove();
                }
              }
            }
          }
        }
        
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
        const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
        const { storage } = await import('@/lib/firebase');
        
        const finalRef = ref(storage, `portfolios/${id}/final.html`);
        
        // Upload the file
        await uploadString(finalRef, finalHtml, 'raw', {
          contentType: 'text/html',
        });
        
        // Verify the upload by getting the download URL
        // This ensures the file is actually available before redirecting
        try {
          await getDownloadURL(finalRef);
          console.log('Portfolio saved and verified successfully');
        } catch (verifyError) {
          console.error('Error verifying portfolio upload:', verifyError);
          // Still continue with redirect even if verification fails
        }
        
        // Save portfolio metadata to Firestore
        if (user) {
          try {
            const portfolioDoc = doc(db, 'users', user.uid, 'portfolios', id);
            const portfolioData = {
              title: portfolioTitle,
              published: true,
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp(), // This will only set on first save
            };
            
            console.log('Saving to Firestore:', {
              userId: user.uid,
              portfolioId: id,
              data: portfolioData
            });
            
            await setDoc(portfolioDoc, portfolioData, { merge: true }); // merge: true ensures we don't overwrite existing fields
            
            console.log('Portfolio metadata saved to Firestore successfully');
          } catch (firestoreError) {
            console.error('Error saving to Firestore:', firestoreError);
            const errorMessage = firestoreError instanceof Error ? firestoreError.message : 'Unknown error';
            alert(`Failed to save portfolio metadata: ${errorMessage}`);
            // Don't fail the whole operation if Firestore fails
          }
        } else {
          console.error('No user found when trying to save to Firestore');
        }
        
        // Add a small delay to ensure propagation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Redirect to the portfolio with a success parameter and cache-busting timestamp
        const timestamp = Date.now();
        router.push(`/portfolio/${id}?success=true&t=${timestamp}`);
      }
    } catch (error) {
      console.error('Error saving portfolio:', error);
      alert('Failed to save portfolio. Please try again.');
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