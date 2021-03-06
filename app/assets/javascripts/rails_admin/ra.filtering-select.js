/*
 * RailsAdmin filtering select @VERSION
 *
 * Based on the combobox example from jQuery UI documentation
 * http://jqueryui.com/demos/autocomplete/#combobox
 *
 * License
 *
 * http://www.railsadmin.org
 *
 * Depends:
 *   jquery.ui.core.js
 *   jquery.ui.widget.js
 *   jquery.ui.autocomplete.js
 */
(function ($) {
    $.widget &&
    $.widget("ra.filteringSelect", {
        options: {
            createQuery: function (query) {
                return {filter_query: query};
            },
            minLength: 0,
            searchDelay: 200,
            remote_source: null,
            source: null,
            xhr: false
        },

        _create: function () {
            var self = this,
                select = this.element.hide(),
                selected = select.children(":selected"),
                value = selected.val() ? selected.text() : "";

            if (this.options.xhr) {
                this.options.source = this.options.remote_source;
                this.options.ui_suffix_name = this.options.suffix_name;
            } else {
                this.options.ui_suffix_name = this.options.suffix_name;
                this.options.source = select.children("option").map(function () {
                    var that = $(this);
                    var template_value = that.data('template-value');
                    return {label: that.text(), value: (template_value ? [this.value, template_value] : [this.value])};
                }).toArray();
            }
            var filtering_select = $('<div class="input-group filtering-select col-sm-2" style="float:left"></div>')
            var input = this.input = $('<input type="text">')
                .val(value)
                .addClass("form-control ra-filtering-select-input")
                .attr('style', select.attr('style'))
                .show()
                .autocomplete({
                    delay: this.options.searchDelay,
                    minLength: this.options.minLength,
                    source: this._getSourceFunction(this.options.source, this.options.ui_suffix_name),
                    select: function (event, ui) {
                        var id = ui.item.id;
                        if (!$.isArray(id)) {
                            id = [id]
                        }
                        var option = $('<option></option>').attr('value', id[0]).attr('selected', 'selected').text(ui.item.value);
                        select.html(option);
                        select.trigger("change", id[0]);
                        self._trigger("selected", event, {
                            item: option
                        });
                        $(self.element.parents('.controls')[0]).find('.update').removeClass('disabled');
                        if (id = id[1]) {
                            $(self.element.parents('.fields')[0]).find('[data-template-name]').each(function () {
                                $(this).attr('data-template-value', id);
                            })
                        }
                    },
                    change: function (event, ui) {
                        if (!ui.item) {
                            var matcher = new RegExp("^" + $.ui.autocomplete.escapeRegex($(this).val()) + "$", "i"),
                                valid = false;
                            select.children("option").each(function () {
                                if ($(this).text().match(matcher)) {
                                    this.selected = valid = true;
                                    return false;
                                }
                            });
                            if (!valid || $(this).val() == '') {
                                //Patch for enum_edit
                                if (select.attr('data-enum_edit')) {
                                    var option = $('<option></option>').attr('value', event.currentTarget.value).attr('selected', 'selected').text(event.currentTarget.value);
                                    select.html(option);
                                }
                                else {
                                    //remove invalid value, as it didn't match anything
                                    $(this).val(null);
                                    select.html($('<option value="" selected="selected"></option>'));
                                    input.data("ui-autocomplete").term = "";
                                    $(self.element.parents('.controls')[0]).find('.update').addClass('disabled');
                                }
                                return false;
                            }
                        }
                    }
                })
                .keyup(function () {
                    /* Clear select options and trigger change if selected item is deleted */
                    if ($(this).val().length == 0) {
                        select.html($('<option value="" selected="selected"></option>'));
                        select.trigger("change");
                    }
                });

            if (select.attr('placeholder'))
                input.attr('placeholder', select.attr('placeholder'))

            input.data("ui-autocomplete")._renderItem = function (ul, item) {
                return $("<li></li>")
                    .data("ui-autocomplete-item", item)
                    .append($("<a></a>").html(item.html || item.id))
                    .appendTo(ul);
            };

            var button = this.button = $('<span class="input-group-btn"><label class="btn btn-info dropdown-toggle" data-toggle="dropdown" aria-expanded="false" title="Show All Items" role="button"><span class="caret"></span><span class="ui-button-text">&nbsp;</span></label></span>')
                .click(function () {
                    if (select.prop('disabled')) return;
                    // close if already visible
                    if (input.autocomplete("widget").is(":visible")) {
                        input.autocomplete("close");
                        return;
                    }

                    // pass empty string as value to search for, displaying all results
                    input.autocomplete("search", "");
                    input.focus();
                });

            filtering_select.append(input).append(button).insertAfter(select);

            select.on('disabled', function (e) {
                input.prop('disabled', true);
                button.find('button').prop('disabled', true);
            });
            select.on('enabled', function (e) {
                input.prop('disabled', false);
                button.find('button').prop('disabled', false);
            });
        },

        _getResultSet: function (request, data, xhr) {
            var matcher = new RegExp($.ui.autocomplete.escapeRegex(request.term), "i");
            var highlighter = function (label, word) {
                if (word.length > 0) {
                    return $.map(label.split(word), function (el, i) {
                        return $('<span></span>').text(el).html();
                    }).join($('<strong></strong>').text(word)[0].outerHTML);
                } else {
                    return $('<span></span>').text(label).html();
                }
            };

            return $.map(data, function (el, i) {
                // match regexp only for local requests, remote ones are already filtered, and label may not contain filtered term.
                if ((el.id || el.value) && (xhr || matcher.test(el.label))) {
                    return {
                        html: highlighter(el.label || el.id, request.term),
                        value: el.label || el.id,
                        id: el.id || el.value
                    };
                }
            });
        },

        _getSourceFunction: function (source, ui_suffix_name) {

            var self = this,
                requestIndex = 0;

            if ($.isArray(source)) {

                return function (request, response) {
                    response(self._getResultSet(request, source, false));
                };

            } else if (typeof source === "string") {

                return function (request, response) {

                    if (this.xhr) {
                        this.xhr.abort();
                    }

                    var $select = $('select[id$=' + '\'' + ui_suffix_name + '\']').first(),
                        template_name_node = $select[0].attributes['data-template-name'],
                        template_value_node = $select[0].attributes['data-template-value'],
                        the_source = source;
                    if (template_name_node && template_name_node.value && template_value_node) {
                        the_source = source.replace(template_name_node.value, template_value_node.value);
                    }

                    this.xhr = $.ajax({
                        url: the_source,
                        data: self.options.createQuery(request.term),
                        dataType: "json",
                        autocompleteRequest: ++requestIndex,
                        select: null,
                        get_ui_widget: function () {
                            var $label, $icon, $siblings;

                            $siblings = $select.siblings();
                            $label = $siblings.find('label.btn');
                            $icon = $siblings.find('label.btn span:first');
                            return {label: $label, icon: $icon};
                        },
                        beforeSend: function () {
                            var select = this.select = this.get_ui_widget();
                            if (select) {
                                select.label.removeClass('btn-danger').addClass('btn-info');
                                select.icon.removeClass().addClass('fa fa-spinner fa-spin');
                            }
                        },
                        success: function (data, status) {
                            var select = this.select;
                            if (this.autocompleteRequest === requestIndex) {
                                response(self._getResultSet(request, data, true));

                            }
                            if (select) {
                                select.label.removeClass('btn-danger').addClass('btn-info');
                                select.icon.removeClass().addClass('caret');
                            }
                        },
                        error: function () {
                            var select = this.select;
                            if (this.autocompleteRequest === requestIndex) {
                                response([]);
                            }
                            if (select) {
                                select.label.removeClass('btn-info').addClass('btn-danger');
                                select.icon.removeClass().addClass('fa fa-times');
                            }
                            console.log('An error happened with the request');
                        }
                    });
                };

            } else {

                return source;
            }
        },

        destroy: function () {
            this.input.remove();
            this.button.remove();
            this.element.show();
            $.Widget.prototype.destroy.call(this);
        }
    });
})(jQuery);
