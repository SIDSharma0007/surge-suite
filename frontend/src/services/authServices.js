import api from './api';

export const authServices = {
  /**
   * Register a new face profile.
   * 
   * @param {string} name - Name of the user.
   * @param {string} image - Base64 encoded image.
   * @param {string} [userId] - Optional custom user ID.
   * @param {string} [deviceId] - Optional device ID.
   * @param {object} [extraMetadata] - Optional extra metadata fields.
   * @returns {Promise} Axios response promise.
   */
  register(name, image, userId = null, deviceId = null, extraMetadata = {}) {
    return api.post('/auth/register/', {
      name,
      image,
      user_id: userId,
      device_id: deviceId,
      extra_metadata: extraMetadata
    });
  },

  /**
   * Verify an image against registered faces.
   * 
   * @param {string} image - Base64 encoded image.
   * @param {string} [deviceId] - Optional device ID.
   * @returns {Promise} Axios response promise.
   */
  verify(image, deviceId = null) {
    return api.post('/auth/verify/', {
      image,
      device_id: deviceId
    });
  },

  /**
   * Get authentication system status.
   * 
   * @returns {Promise} Axios response promise.
   */
  status() {
    return api.get('/auth/status/');
  }
};
