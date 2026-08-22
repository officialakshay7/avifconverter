(function () {
  "use strict";

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }
  function $all(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }
  function bytesToSize(bytes) {
    if (bytes === 0) return "0 B";
    var k = 1024,
      sizes = ["B", "KB", "MB", "GB"],
      i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }
  function isAvifFile(file) {
    return (
      file.type === "image/avif" ||
      /\.avif$/i.test(file.name)
    );
  }

  function initConverter(root) {
    var mode = root.getAttribute("data-mode") || "both"; // "both" | "jpg" | "png"
    var dropzone = $("[data-dropzone]", root);
    var input = $("[data-file-input]", root);
    var browseBtn = $("[data-browse-btn]", root);
    var list = $("[data-file-list]", root);
    var empty = $("[data-empty-state]", root);
    var formatSelect = $("[data-format-select]", root);
    var qualityWrap = $("[data-quality-wrap]", root);
    var qualitySlider = $("[data-quality-slider]", root);
    var qualityValue = $("[data-quality-value]", root);
    var downloadAllBtn = $("[data-download-all]", root);
    var clearAllBtn = $("[data-clear-all]", root);
    var supportWarning = $("[data-support-warning]", root);
    var counter = $("[data-file-counter]", root);

    var items = []; // {id, file, url, status, outBlob, outUrl, outName, outSize}
    var idSeq = 0;

    function currentFormat() {
      if (mode === "jpg") return "jpeg";
      if (mode === "png") return "png";
      return formatSelect ? formatSelect.value : "jpeg";
    }
    function currentExt() {
      return currentFormat() === "jpeg" ? "jpg" : "png";
    }
    function currentQuality() {
      if (currentFormat() !== "jpeg") return undefined;
      return qualitySlider ? Number(qualitySlider.value) / 100 : 0.9;
    }

    function updateQualityVisibility() {
      if (!qualityWrap) return;
      var show = currentFormat() === "jpeg";
      qualityWrap.classList.toggle("hidden", !show);
    }
    updateQualityVisibility();
    if (formatSelect) {
      formatSelect.addEventListener("change", function () {
        updateQualityVisibility();
        items.forEach(reconvert);
      });
    }
    if (qualitySlider) {
      qualitySlider.addEventListener("input", function () {
        if (qualityValue) qualityValue.textContent = qualitySlider.value + "%";
        items.forEach(reconvert);
      });
    }

    // Feature detection: can this browser decode AVIF at all?
    var AVIF_PROBE =
      "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAKAAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAMG1kYXQSAAoIGAAGiAhoNCAyGhlHh4Yhh5555oAAAJBAyRxhSytNj1FFTqSg";

    function detectAvifSupport() {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          resolve(img.naturalWidth > 0);
        };
        img.onerror = function () {
          resolve(false);
        };
        img.src = AVIF_PROBE;
      });
    }

    detectAvifSupport().then(function (supported) {
      if (!supported && supportWarning) {
        supportWarning.classList.remove("hidden");
      }
    });

    function updateEmptyState() {
      if (!empty || !list) return;
      var has = items.length > 0;
      empty.classList.toggle("hidden", has);
      list.classList.toggle("hidden", !has);
      if (downloadAllBtn) downloadAllBtn.classList.toggle("hidden", !has);
      if (clearAllBtn) clearAllBtn.classList.toggle("hidden", !has);
      if (counter) {
        counter.textContent = items.length
          ? items.length + (items.length === 1 ? " file" : " files")
          : "";
      }
    }

    function render(item) {
      var el = document.getElementById(item.id);
      if (!el) return;
      var statusEl = $("[data-status]", el);
      var sizeEl = $("[data-size]", el);
      var dlBtn = $("[data-item-download]", el);
      var savingsEl = $("[data-savings]", el);

      if (item.status === "converting") {
        statusEl.textContent = "Converting…";
        statusEl.className = "text-xs font-medium text-avif";
      } else if (item.status === "error") {
        statusEl.textContent = "Couldn't convert this file";
        statusEl.className = "text-xs font-medium text-red-400";
      } else if (item.status === "done") {
        statusEl.textContent = "Ready";
        statusEl.className = "text-xs font-medium text-png";
        sizeEl.textContent =
          bytesToSize(item.file.size) + " → " + bytesToSize(item.outSize);
        if (dlBtn) {
          dlBtn.href = item.outUrl;
          dlBtn.download = item.outName;
          dlBtn.classList.remove("hidden");
        }
        if (savingsEl) {
          var diff = Math.round(
            (1 - item.outSize / item.file.size) * 100
          );
          if (diff > 0) {
            savingsEl.textContent = "-" + diff + "%";
            savingsEl.classList.remove("hidden");
          } else {
            savingsEl.classList.add("hidden");
          }
        }
      }
    }

    function convert(item) {
      item.status = "converting";
      render(item);

      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var ctx = canvas.getContext("2d");
          if (currentFormat() === "jpeg") {
            // JPEG has no alpha channel — flatten onto white
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0);

          var mime = currentFormat() === "jpeg" ? "image/jpeg" : "image/png";
          var quality = currentQuality();

          canvas.toBlob(
            function (blob) {
              if (!blob) {
                item.status = "error";
                render(item);
                return;
              }
              if (item.outUrl) URL.revokeObjectURL(item.outUrl);
              item.outBlob = blob;
              item.outUrl = URL.createObjectURL(blob);
              item.outSize = blob.size;
              item.outName =
                item.file.name.replace(/\.avif$/i, "") + "." + currentExt();
              item.status = "done";
              render(item);
            },
            mime,
            quality
          );
        } catch (e) {
          item.status = "error";
          render(item);
        }
      };
      img.onerror = function () {
        item.status = "error";
        render(item);
      };
      img.src = item.url;
    }

    function reconvert(item) {
      if (item.status === "error") return;
      convert(item);
    }

    function cardTemplate(item) {
      return (
        '<div id="' +
        item.id +
        '" class="flex flex-col gap-3 border-b border-surface-border p-4 last:border-b-0 sm:flex-row sm:items-center">' +
        '<div class="flex min-w-0 flex-1 items-center gap-3">' +
        '<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-avif/10 text-avif">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 16.5V7.5C4 6.67157 4.67157 6 5.5 6H18.5C19.3284 6 20 6.67157 20 7.5V16.5C20 17.3284 19.3284 18 18.5 18H5.5C4.67157 18 4 17.3284 4 16.5Z" stroke="currentColor" stroke-width="1.6"/><path d="M8 14L10.2 11.2C10.6 10.68 11.34 10.66 11.76 11.16L13.5 13.2L15 11.5C15.42 11.02 16.14 11.03 16.55 11.52L18 13.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        "</div>" +
        '<div class="min-w-0">' +
        '<p class="truncate text-sm font-medium text-ink-50">' +
        item.file.name +
        "</p>" +
        '<div class="mt-0.5 flex items-center gap-2">' +
        '<span data-status class="text-xs font-medium text-ink-400">Waiting…</span>' +
        '<span data-size class="text-xs text-ink-500"></span>' +
        '<span data-savings class="hidden rounded-full bg-png/10 px-1.5 py-0.5 text-[10px] font-bold text-png"></span>' +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div class="flex shrink-0 items-center gap-2 sm:justify-end">' +
        '<a data-item-download class="btn-primary hidden !px-4 !py-2 text-xs" href="#">Download</a>' +
        '<button data-item-remove class="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-ink-400 hover:border-red-400/40 hover:text-red-400" aria-label="Remove file">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
        "</button>" +
        "</div>" +
        "</div>"
      );
    }

    function addFiles(fileList) {
      var files = Array.prototype.slice.call(fileList);
      var avifFiles = files.filter(isAvifFile);
      var rejected = files.length - avifFiles.length;

      avifFiles.forEach(function (file) {
        var item = {
          id: "file-" + ++idSeq,
          file: file,
          url: URL.createObjectURL(file),
          status: "pending",
        };
        items.push(item);
        list.insertAdjacentHTML("beforeend", cardTemplate(item));
        var el = document.getElementById(item.id);
        $("[data-item-remove]", el).addEventListener("click", function () {
          removeItem(item.id);
        });
        convert(item);
      });

      if (rejected > 0) {
        showToast(
          rejected + " file" + (rejected > 1 ? "s were" : " was") +
            " skipped — only .avif files are supported."
        );
      }
      updateEmptyState();
    }

    function removeItem(id) {
      var idx = items.findIndex(function (it) {
        return it.id === id;
      });
      if (idx === -1) return;
      var item = items[idx];
      if (item.url) URL.revokeObjectURL(item.url);
      if (item.outUrl) URL.revokeObjectURL(item.outUrl);
      var el = document.getElementById(id);
      if (el) el.remove();
      items.splice(idx, 1);
      updateEmptyState();
    }

    function clearAll() {
      items.slice().forEach(function (it) {
        removeItem(it.id);
      });
    }

    function showToast(msg) {
      var toast = document.createElement("div");
      toast.className =
        "fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-sm text-ink-100 shadow-2xl shadow-black/50";
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(function () {
        toast.style.transition = "opacity 300ms";
        toast.style.opacity = "0";
        setTimeout(function () {
          toast.remove();
        }, 320);
      }, 3200);
    }

    if (dropzone) {
      ["dragenter", "dragover"].forEach(function (evt) {
        dropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add("border-avif", "bg-avif/5");
        });
      });
      ["dragleave", "drop"].forEach(function (evt) {
        dropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove("border-avif", "bg-avif/5");
        });
      });
      dropzone.addEventListener("drop", function (e) {
        if (e.dataTransfer && e.dataTransfer.files.length) {
          addFiles(e.dataTransfer.files);
        }
      });
      dropzone.addEventListener("click", function () {
        if (input) input.click();
      });
    }
    if (browseBtn && input) {
      browseBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        input.click();
      });
    }
    if (input) {
      input.addEventListener("change", function () {
        if (input.files && input.files.length) addFiles(input.files);
        input.value = "";
      });
    }
    if (clearAllBtn) clearAllBtn.addEventListener("click", clearAll);
    if (downloadAllBtn) {
      downloadAllBtn.addEventListener("click", function () {
        var done = items.filter(function (it) {
          return it.status === "done";
        });
        done.forEach(function (item, i) {
          setTimeout(function () {
            var a = document.createElement("a");
            a.href = item.outUrl;
            a.download = item.outName;
            document.body.appendChild(a);
            a.click();
            a.remove();
          }, i * 220);
        });
      });
    }

    updateEmptyState();
  }

  document.addEventListener("DOMContentLoaded", function () {
    $all("[data-converter]").forEach(initConverter);
  });
})();
