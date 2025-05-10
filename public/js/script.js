document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const fileName = document.getElementById('fileName');
    const uploadForm = document.getElementById('uploadForm');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
  
    // Update file name when a file is selected
    fileInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        fileName.textContent = this.files[0].name;
      } else {
        fileName.textContent = 'No file chosen';
      }
    });
  
    // Handle form submission
    uploadForm.addEventListener('submit', function(event) {
      if (!fileInput.files || !fileInput.files[0]) {
        return;
      }
  
      // Show progress bar
      progressContainer.style.display = 'block';
      progressBar.style.width = '0%';
      progressText.textContent = '0%';
  
      // Create FormData and XMLHttpRequest
      const formData = new FormData(uploadForm);
      const xhr = new XMLHttpRequest();
  
      // Upload progress event
      xhr.upload.addEventListener('progress', function(e) {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          progressBar.style.width = percent + '%';
          progressText.textContent = percent + '%';
        }
      });
  
      // Upload complete
      xhr.addEventListener('load', function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Success - redirect to the homepage as the server does
          window.location.href = '/';
        } else {
          // Error
          alert('Upload failed: ' + xhr.statusText);
          progressContainer.style.display = 'none';
        }
      });
  
      // Upload error
      xhr.addEventListener('error', function() {
        alert('Upload failed. Check your connection and try again.');
        progressContainer.style.display = 'none';
      });
  
      // Open and send the request
      xhr.open('POST', '/upload', true);
      xhr.send(formData);
  
      // Prevent default form submission
      event.preventDefault();
    });
  });