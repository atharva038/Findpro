let cropper;

document.addEventListener("DOMContentLoaded", function () {
    const profileImage = document.getElementById("profileImage");
    const cropImage = document.getElementById("cropImage");
    const imageCropModal = new bootstrap.Modal(document.getElementById("imageCropModal"));

    // Handle image selection
    profileImage.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert("File size too large. Please select an image under 5MB.");
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                cropImage.src = e.target.result;
                imageCropModal.show();

                if (cropper) {
                    cropper.destroy();
                }
                cropper = new Cropper(cropImage, {
                    aspectRatio: 1,
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 1,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                });
            };
            reader.readAsDataURL(file);
        }
    });

    // Handle crop and upload
    document.getElementById("cropButton").addEventListener("click", async function () {
        try {
            // Show loading state
            const cropButton = this;
            const originalText = cropButton.innerHTML;
            cropButton.disabled = true;
            cropButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';


            const canvas = cropper.getCroppedCanvas({
                width: 300,
                height: 300,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            const formData = new FormData();
            formData.append("profileImage", blob, "profile.jpg");

            const response = await fetch("/profile/update", {
                method: "POST",
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                // Update all instances of the profile image
                const profileImages = document.querySelectorAll('.profile-image');
                profileImages.forEach(img => {
                    img.src = data.user.profileImage;
                });

                // Close modal and show success message
                imageCropModal.hide();
                showToast('success', 'Profile picture updated successfully!');
            } else {
                throw new Error(data.error || "Failed to update profile image");
            }
        } catch (error) {
            console.error("Error updating profile image:", error);
            showToast('error', 'Failed to update profile picture. Please try again.');
        } finally {
            // Reset button state
            const cropButton = document.getElementById("cropButton");
            cropButton.disabled = false;
            cropButton.innerHTML = '<i class="fas fa-crop me-1"></i>Crop & Save';
        }
    });
});

async function saveProfile() {
    const name = document.getElementById("editName").value.trim();
    const phone = document.getElementById("editPhone").value.trim();
    const address = document.getElementById("editAddress").value.trim();

    if (!name) {
        showToast('error', 'Name cannot be empty');
        return;
    }

    try {
        const response = await fetch("/profile/update", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ name, phone, address }),
        });

        const data = await response.json();
        if (data.success) {
            // Update UI
            document.querySelector('.user-name').textContent = name;
            document.querySelector('.detail-item:nth-child(1) p').textContent = phone || 'Not provided';
            document.querySelector('.detail-item:nth-child(2) p').textContent = address || 'Not provided';

            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('editProfileModal')).hide();

            showToast('success', 'Profile updated successfully!');
        } else {
            throw new Error(data.error || "Failed to update profile");
        }
    } catch (error) {
        console.error("Error updating profile:", error);
        showToast('error', 'Failed to update profile. Please try again.');
    }
}

function showToast(type, message) {
    // Assuming you have a toast notification system
    // Replace this with your actual toast implementation
    if (type === 'error') {
        alert(message);
    } else {
        alert(message);
    }
} function openEditModal() {
    const editProfileModal = new bootstrap.Modal(document.getElementById('editProfileModal'));

    // Pre-fill the form with current values
    document.getElementById('editName').value = document.querySelector('.user-name').textContent.trim();
    document.getElementById('editPhone').value = document.querySelector('.detail-item:nth-child(1) p').textContent.trim();
    const address = document.querySelector('.detail-item:nth-child(2) p').textContent.trim();
    document.getElementById('editAddress').value = address === 'Not provided' ? '' : address;

    editProfileModal.show();
}
