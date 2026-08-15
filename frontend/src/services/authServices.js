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
    const payload = {
      name,
      image,
      user_id: userId,
      device_id: deviceId,
      extra_metadata: extraMetadata
    };
    console.log("[INSTRUMENTATION] authServices.register() payload:", {
      keys: Object.keys(payload),
      imageLength: image ? image.length : 0,
      payloadJSONSize: JSON.stringify(payload).length
    });
    return api.post('/auth/register/', payload);
  },

  /**
   * Verify an image against registered faces.
   * 
   * @param {string} image - Base64 encoded image.
   * @param {string} [deviceId] - Optional device ID.
   * @returns {Promise} Axios response promise.
   */
  verify(image, deviceId = null) {
    const payload = {
      image,
      device_id: deviceId
    };
    console.log("[INSTRUMENTATION] authServices.verify() payload:", {
      keys: Object.keys(payload),
      imageLength: image ? image.length : 0,
      payloadJSONSize: JSON.stringify(payload).length
    });
    return api.post('/auth/verify/', payload);
  },

  /**
   * Get authentication system status.
   * 
   * @returns {Promise} Axios response promise.
   */
  status() {
    return api.get('/auth/status/');
  },

  /**
   * Terminate current server session.
   * 
   * @returns {Promise} Axios response promise.
   */
  logout() {
    return api.post('/auth/logout/');
  },

  /**
   * Retrieve current authenticated user details from server session.
   * 
   * @returns {Promise} Axios response promise.
   */
  me() {
    return api.get('/auth/me/');
  }
};
