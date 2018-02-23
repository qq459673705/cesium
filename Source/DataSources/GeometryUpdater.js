define([
    '../Core/Check',
    '../Core/Color',
    '../Core/defaultValue',
    '../Core/defined',
    '../Core/defineProperties',
    '../Core/destroyObject',
    '../Core/DeveloperError',
    '../Core/DistanceDisplayCondition',
    '../Core/Event',
    '../Core/Iso8601',
    '../Core/oneTimeWarning',
    '../Scene/ShadowMode',
    './ColorMaterialProperty',
    './ConstantProperty',
    './Property'
], function(
    Check,
    Color,
    defaultValue,
    defined,
    defineProperties,
    destroyObject,
    DeveloperError,
    DistanceDisplayCondition,
    Event,
    Iso8601,
    oneTimeWarning,
    ShadowMode,
    ColorMaterialProperty,
    ConstantProperty,
    Property) {
    'use strict';

    var defaultMaterial = new ColorMaterialProperty(Color.WHITE);
    var defaultShow = new ConstantProperty(true);
    var defaultFill = new ConstantProperty(true);
    var defaultOutline = new ConstantProperty(false);
    var defaultOutlineColor = new ConstantProperty(Color.BLACK);
    var defaultShadows = new ConstantProperty(ShadowMode.DISABLED);
    var defaultDistanceDisplayCondition = new ConstantProperty(new DistanceDisplayCondition());

    /**
     * A {@link GeometryUpdater} for boxes.
     * Clients do not normally create this class directly, but instead rely on {@link DataSourceDisplay}.
     * @alias GeometryUpdater
     * @constructor
     *
     * @param {Object} options An object with the following properties:
     * @param {Entity} options.entity The entity containing the geometry to be visualized.
     * @param {Scene} options.scene The scene where visualization is taking place.
     * @param {Object} options.geometryOptions Options for the geometry
     * @param {String} options.geometryPropertyName The geometry property name
     * @param {String[]} options.observedPropertyNames The entity properties this geometry cares about
     */
    function GeometryUpdater(options) {
        //>>includeStart('debug', pragmas.debug);
        Check.defined('options.entity', options.entity);
        Check.defined('options.scene', options.scene);
        Check.defined('options.geometryOptions', options.geometryOptions);
        Check.defined('options.geometryPropertyName', options.geometryPropertyName);
        Check.defined('options.observedPropertyNames', options.observedPropertyNames);
        //>>includeEnd('debug');

        var entity = options.entity;
        var geometryPropertyName = options.geometryPropertyName;

        this._entity = entity;
        this._scene = options.scene;
        this._fillEnabled = false;
        this._isClosed = false;
        this._onTerrain = false;
        this._dynamic = false;
        this._outlineEnabled = false;
        this._geometryChanged = new Event();
        this._showProperty = undefined;
        this._materialProperty = undefined;
        this._showOutlineProperty = undefined;
        this._outlineColorProperty = undefined;
        this._outlineWidth = 1.0;
        this._shadowsProperty = undefined;
        this._distanceDisplayConditionProperty = undefined;
        this._options = options.geometryOptions;
        this._geometryPropertyName = geometryPropertyName;
        this._id = geometryPropertyName + '-' + entity.id;
        this._observedPropertyNames = options.observedPropertyNames;

        this._onEntityPropertyChanged(entity, geometryPropertyName, entity[geometryPropertyName], undefined);
    }

    defineProperties(GeometryUpdater.prototype, {
        /**
         * Gets the unique ID associated with this updater
         * @memberof GeometryUpdater.prototype
         * @type {String}
         * @readonly
         */
        id : {
            get : function() {
                return this._id;
            }
        },
        /**
         * Gets the entity associated with this geometry.
         * @memberof GeometryUpdater.prototype
         *
         * @type {Entity}
         * @readonly
         */
        entity : {
            get : function() {
                return this._entity;
            }
        },
        /**
         * Gets a value indicating if the geometry has a fill component.
         * @memberof GeometryUpdater.prototype
         *
         * @type {Boolean}
         * @readonly
         */
        fillEnabled : {
            get : function() {
                return this._fillEnabled;
            }
        },
        /**
         * Gets a value indicating if fill visibility varies with simulation time.
         * @memberof GeometryUpdater.prototype
         *
         * @type {Boolean}
         * @readonly
         */
        hasConstantFill : {
            get : function() {
                return !this._fillEnabled ||
                       (!defined(this._entity.availability) &&
                        Property.isConstant(this._showProperty) &&
                        Property.isConstant(this._fillProperty));
            }
        },
        /**
         * Gets the material property used to fill the geometry.
         * @memberof GeometryUpdater.prototype
         *
         * @type {MaterialProperty}
         * @readonly
         */
        fillMaterialProperty : {
            get : function() {
                return this._materialProperty;
            }
        },
        /**
         * Gets a value indicating if the geometry has an outline component.
         * @memberof GeometryUpdater.prototype
         *
         * @type {Boolean}
         * @readonly
         */
        outlineEnabled : {
            get : function() {
                return this._outlineEnabled;
            }
        },
        /**
         * Gets a value indicating if the geometry has an outline component.
         * @memberof GeometryUpdater.prototype
         *
         * @type {Boolean}
         * @readonly
         */
        hasConstantOutline : {
            get : function() {
                return !this._outlineEnabled ||
                       (!defined(this._entity.availability) &&
                        Property.isConstant(this._showProperty) &&
                        Property.isConstant(this._showOutlineProperty));
            }
        },
        /**
         * Gets the {@link Color} property for the geometry outline.
         * @memberof GeometryUpdater.prototype
         *
         * @type {Property}
         * @readonly
         */
        outlineColorProperty : {
            get : function() {
                return this._outlineColorProperty;
            }
        },
        /**
         * Gets the constant with of the geometry outline, in pixels.
         * This value is only valid if isDynamic is false.
         * @memberof GeometryUpdater.prototype
         *
         * @type {Number}
         * @readonly
         */
        outlineWidth : {
            get : function() {
                return this._outlineWidth;
            }
        },
        /**
         * Gets the property specifying whether the geometry
         * casts or receives shadows from each light source.
         * @memberof GeometryUpdater.prototype
         *
         * @type {Property}
         * @readonly
         */
        shadowsProperty : {
            get : function() {
                return this._shadowsProperty;
            }
        },
        /**
         * Gets or sets the {@link DistanceDisplayCondition} Property specifying at what distance from the camera that this geometry will be displayed.
         * @memberof GeometryUpdater.prototype
         *
         * @type {Property}
         * @readonly
         */
        distanceDisplayConditionProperty : {
            get : function() {
                return this._distanceDisplayConditionProperty;
            }
        },
        /**
         * Gets a value indicating if the geometry is time-varying.
         * If true, all visualization is delegated to the {@link DynamicGeometryUpdater}
         * returned by GeometryUpdater#createDynamicUpdater.
         * @memberof GeometryUpdater.prototype
         *
         * @type {Boolean}
         * @readonly
         */
        isDynamic : {
            get : function() {
                return this._dynamic;
            }
        },
        /**
         * Gets a value indicating if the geometry is closed.
         * This property is only valid for static geometry.
         * @memberof GeometryUpdater.prototype
         *
         * @type {Boolean}
         * @readonly
         */
        isClosed : {
            get : function() {
                return this._isClosed;
            }
        },
        /**
         * Gets a value indicating if the geometry should be drawn on terrain.
         * @memberof EllipseGeometryUpdater.prototype
         *
         * @type {Boolean}
         * @readonly
         */
        onTerrain : {
            get : function() {
                return this._onTerrain;
            }
        },
        /**
         * Gets an event that is raised whenever the public properties
         * of this updater change.
         * @memberof GeometryUpdater.prototype
         *
         * @type {Boolean}
         * @readonly
         */
        geometryChanged : {
            get : function() {
                return this._geometryChanged;
            }
        }
    });

    /**
     * Checks if the geometry is outlined at the provided time.
     *
     * @param {JulianDate} time The time for which to retrieve visibility.
     * @returns {Boolean} true if geometry is outlined at the provided time, false otherwise.
     */
    GeometryUpdater.prototype.isOutlineVisible = function(time) {
        var entity = this._entity;
        return this._outlineEnabled && entity.isAvailable(time) && this._showProperty.getValue(time) && this._showOutlineProperty.getValue(time);
    };

    /**
     * Checks if the geometry is filled at the provided time.
     *
     * @param {JulianDate} time The time for which to retrieve visibility.
     * @returns {Boolean} true if geometry is filled at the provided time, false otherwise.
     */
    GeometryUpdater.prototype.isFilled = function(time) {
        var entity = this._entity;
        return this._fillEnabled && entity.isAvailable(time) && this._showProperty.getValue(time) && this._fillProperty.getValue(time);
    };

    /**
     * Creates the geometry instance which represents the fill of the geometry.
     *
     * @param {JulianDate} time The time to use when retrieving initial attribute values.
     * @returns {GeometryInstance} The geometry instance representing the filled portion of the geometry.
     *
     * @exception {DeveloperError} This instance does not represent a filled geometry.
     */
    GeometryUpdater.prototype.createFillGeometryInstance = DeveloperError.throwInstantiationError;

    /**
     * Creates the geometry instance which represents the outline of the geometry.
     *
     * @param {JulianDate} time The time to use when retrieving initial attribute values.
     * @returns {GeometryInstance} The geometry instance representing the outline portion of the geometry.
     *
     * @exception {DeveloperError} This instance does not represent an outlined geometry.
     */
    GeometryUpdater.prototype.createOutlineGeometryInstance = DeveloperError.throwInstantiationError;

    /**
     * Returns true if this object was destroyed; otherwise, false.
     *
     * @returns {Boolean} True if this object was destroyed; otherwise, false.
     */
    GeometryUpdater.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Destroys and resources used by the object.  Once an object is destroyed, it should not be used.
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     */
    GeometryUpdater.prototype.destroy = function() {
        destroyObject(this);
    };
    /**
     * @param {Entity} entity
     * @param {Object} geometry
     * @private
     */
    GeometryUpdater.prototype._isHidden = function(entity, geometry) {
        var show = geometry.show;
        return defined(show) && show.isConstant && !show.getValue(Iso8601.MINIMUM_VALUE);
    };

    /**
     * @param {Entity} entity
     * @param {Object} geometry
     * @private
     */
    GeometryUpdater.prototype._isOnTerrain = function(entity, geometry) {
        return false;
    };

    /**
     * @param {Entity} entity
     * @param {Object} geometry
     * @private
     */
    GeometryUpdater.prototype._getIsClosed = function(entity, geometry) {
        return true;
    };

    /**
     * @param {Entity} entity
     * @param {Object} geometry
     * @private
     */
    GeometryUpdater.prototype._isDynamic = DeveloperError.throwInstantiationError;

    /**
     * @param {Entity} entity
     * @param {Object} geometry
     * @private
     */
    GeometryUpdater.prototype._setStaticOptions = DeveloperError.throwInstantiationError;

    /**
     * @param {Entity} entity
     * @param {String} propertyName
     * @param {Object} newValue
     * @param {Object} oldValue
     * @private
     */
    GeometryUpdater.prototype._onEntityPropertyChanged = function(entity, propertyName, newValue, oldValue) {
        if (this._observedPropertyNames.indexOf(propertyName) === -1) {
            return;
        }

        var geometry = this._entity[this._geometryPropertyName];

        if (!defined(geometry)) {
            if (this._fillEnabled || this._outlineEnabled) {
                this._fillEnabled = false;
                this._outlineEnabled = false;
                this._geometryChanged.raiseEvent(this);
            }
            return;
        }

        var fillProperty = geometry.fill;
        var fillEnabled = defined(fillProperty) && fillProperty.isConstant ? fillProperty.getValue(Iso8601.MINIMUM_VALUE) : true;

        var outlineProperty = geometry.outline;
        var outlineEnabled = defined(outlineProperty);
        if (outlineEnabled && outlineProperty.isConstant) {
            outlineEnabled = outlineProperty.getValue(Iso8601.MINIMUM_VALUE);
        }

        if (!fillEnabled && !outlineEnabled) {
            if (this._fillEnabled || this._outlineEnabled) {
                this._fillEnabled = false;
                this._outlineEnabled = false;
                this._geometryChanged.raiseEvent(this);
            }
            return;
        }

        var show = geometry.show;
        if (this._isHidden(entity, geometry)) {
            if (this._fillEnabled || this._outlineEnabled) {
                this._fillEnabled = false;
                this._outlineEnabled = false;
                this._geometryChanged.raiseEvent(this);
            }
            return;
        }

        this._materialProperty = defaultValue(geometry.material, defaultMaterial);
        this._fillProperty = defaultValue(fillProperty, defaultFill);
        this._showProperty = defaultValue(show, defaultShow);
        this._showOutlineProperty = defaultValue(geometry.outline, defaultOutline);
        this._outlineColorProperty = outlineEnabled ? defaultValue(geometry.outlineColor, defaultOutlineColor) : undefined;
        this._shadowsProperty = defaultValue(geometry.shadows, defaultShadows);
        this._distanceDisplayConditionProperty = defaultValue(geometry.distanceDisplayCondition, defaultDistanceDisplayCondition);

        this._fillEnabled = fillEnabled;

        var onTerrain = this._isOnTerrain(entity, geometry);
        if (outlineEnabled && onTerrain) {
            oneTimeWarning(oneTimeWarning.geometryOutlines);
            outlineEnabled = false;
        }

        this._onTerrain = onTerrain;
        this._isClosed = this._getIsClosed(entity, geometry);
        this._outlineEnabled = outlineEnabled;

        if (this._isDynamic(entity, geometry)) {
            if (!this._dynamic) {
                this._dynamic = true;
                this._geometryChanged.raiseEvent(this);
            }
        } else {
            this._setStaticOptions(entity, geometry);
            var outlineWidth = geometry.outlineWidth;
            this._outlineWidth = defined(outlineWidth) ? outlineWidth.getValue(Iso8601.MINIMUM_VALUE) : 1.0;
            this._dynamic = false;
            this._geometryChanged.raiseEvent(this);
        }
    };

    /**
     * Creates the dynamic updater to be used when GeometryUpdater#isDynamic is true.
     *
     * @param {PrimitiveCollection} primitives The primitive collection to use.
     * @param {PrimitiveCollection} [groundPrimitives] The primitive collection to use for ground primitives.
     *
     * @returns {DynamicGeometryUpdater} The dynamic updater used to update the geometry each frame.
     *
     * @exception {DeveloperError} This instance does not represent dynamic geometry.
     */
    GeometryUpdater.prototype.createDynamicUpdater = function(primitives, groundPrimitives) {
        //>>includeStart('debug', pragmas.debug);
        Check.defined('primitives', primitives);
        Check.defined('groundPrimitives', groundPrimitives);

        if (!this._dynamic) {
            throw new DeveloperError('This instance does not represent dynamic geometry.');
        }
        //>>includeEnd('debug');

        return new this.constructor.DynamicGeometryUpdater(this, primitives, groundPrimitives);
    };

    return GeometryUpdater;
});
