/*
 * Configuration for the Drive Explorer.
 *
 * The default folder is used unless a page URL supplies ?folder=FOLDER_ID.
 * Optional ?name=DISPLAY_NAME changes the heading/breadcrumb root label.
 * Never put an OAuth client secret in this file.
 */
(() => {
  const params = new URLSearchParams(window.location.search);
  const defaultFolderId = "1nZN_ZnTFAfmG0do1vhFoTv87Jxjhp-iu";
  const defaultFolderName = "Document Library";

  window.DRIVE_EXPLORER_CONFIG = {
    API_KEY: "AIzaSyDXyata1Tk1ooowyLkcqpIPBU2076BFSxY",
    ROOT_FOLDER_ID: params.get("folder") || defaultFolderId,
    ROOT_FOLDER_NAME: params.get("name") || defaultFolderName,
    PAGE_SIZE: 100
  };
})();
