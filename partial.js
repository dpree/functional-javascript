/* Copyright 2007 by Oliver Steele.
 *
 * License: This work is licensed under the MIT license, and the
 * Creative Commons Attribution-Noncommercial-Share Alike 3.0 License
 * http://creativecommons.org/licenses/by-nc-sa/3.0/.
 * Take your pick.
 *
 * Source: http://osteele.com/javascripts/partial.js
 * Demo: http://osteele.com/javascripts/partials-demo.html
 *
 * This file defines some functionals for partial function application, as
 * well as some other utilities for functional programming.  It doesn't
 * include collection functions (map, reduce, each, select), since
 * most other libraries define them.
 */

/*
 * Agenda:
 * - 'x+1'.apply(null, [2]) returns '21'
 * - foldr, foldl, flip (with args), fst, snd, pair
 * - remove toFunction?
 * - remove only?
 * - rename partial -> specialize?
 * - rename to functional.js
 * - change license
 */

// The identity function: x -> x.
// :: x -> x
Function.I = function(x) {return x};

// Returns a constant function that returns +x+.
// :: x -> _ -> x
Function.K = function(x) {return function() {return x}}

// Returns a bound method on +object+; optionally currying +args+.
Function.prototype.bind = function(object/*, args...*/) {
    var fn = this;
    var args = [].slice.call(arguments, 1);
    return function() {
        return fn.apply(object, args.concat([].slice.call(arguments, 0)));
    }
}

// a unique value for use in +partial()+ (below)
var _ = {};

// Returns a function +f2+ that applies the original function to a combination
// of +arguments+ and the arguments +args2+ to +f2+.  Where +arguments+ contains any
// value except +_+, this value is used.  Where +arguments+ contains a +_+, the
// next argument from the +args2+ is used.  If any values remain in +args2+
// once all the +_+ have been filled in, they are appended to the end of
// +arguments+.  Finally, the underlying function is applied to the modified
// +arguments+.
// 
// If argument combination produces a list with any +_+, a new partial function
// is returned, and the underlying function is not invoked.
Function.prototype.partial = function(/*arguments*/) {
    var fn = this;
    var args = [].slice.call(arguments, 0);
    // substitution positions
    var subpos = [], value;
    for (var i = 0; i < arguments.length; i++)
        arguments[i] == _ && subpos.push(i);
    return function() {
        var specialized = args.concat([].slice.call(arguments, subpos.length));
        for (var i = 0; i < Math.min(subpos.length, arguments.length); i++)
            specialized[subpos[i]] = arguments[i];
        for (var i = 0; i < specialized.length; i++)
            if (specialized[i] == _)
                return fn.partial.apply(fn, specialized);
        return fn.apply(this, specialized);
    }
}

// Curry.  Returns a function that, applied to an argument list +arg2+,
// applyies the underlying function to +args+ + +arg2+.
// Adapted from http://www.coryhudson.com/blog/2007/03/10/javascript-currying-redux/
// :: f args... -> args2... -> f args... args2...
Function.prototype.curry = function(/*args...*/) {
    var fn = this;
    var args = [].slice.call(arguments, 0);
    return function() {
        return fn.apply(this, args.concat([].slice.call(arguments, 0)));
    };
}

// Right curry.  Returns a function that, applied to an argumen list +args2+,
// appies the underlying function to +args2+ + +args+.
// :: f args... -> args2... -> f args2... args...
Function.prototype.rcurry = function(/*args...*/) {
    var fn = this;
    var args = [].slice.call(arguments, 0);
    return function() {
        return fn.apply(this, [].slice.call(arguments, 0).concat(args));
    };
}

// Same as curry, except only applies the function when all
// +n+ arguments are saturated.
Function.prototype.ncurry = function(n/*, args...*/) {
    var fn = this;
    var largs = [].slice.call(arguments, 1);
    return function() {
        var args = largs.concat([].slice.call(arguments, 0));
        if (args.length < n) {
            args.unshift(n);
            return fn.ncurry.apply(fn, args);
        }
        return fn.apply(this, args);
    };
}

// Same as rcurry, except only applies the function when all
// +n+ arguments are saturated.
Function.prototype.rncurry = function(n/*, args...*/) {
    var fn = this;
    var rargs = [].slice.call(arguments, 1);
    return function() {
        var args = [].slice.call(arguments, 0).concat(rargs);
        if (args.length < n) {
            args.unshift(n);
            return fn.rncurry.apply(fn, args);
        }
        return fn.apply(this, args);
    };
}

Function.prototype.flip = function() {
    var fn = this;
    return function() {
        return fn.apply(this, arguments[1], [arguments[0]].concat([].slice.call(arguments, 2)));
    }
}

// :: f args... -> args2... -> f args...
// Returns a function that ignores arguments.
Function.prototype.only = function() {
    var fn = this;
    var args = [].slice.call(arguments, 0);
    return function() {
        return fn.apply(this, args);
    }
}

var Functional = window.Functional || {};

// Install all the functions in +Functional+ (except this one)
// in the global namespace.
Functional.install = function() {
    var source = Functional;
    var target = window;
    for (var name in source)
        name == 'install' || {}[name] || (target[name] = source[name]);
}

// Return a function that applied the last argument of this
// function to its input, and the penultimate argument to this,
// and so on.
// :: f1 f2 f3... fn -> args -> f1(f2(f3(...(fn(*args)))))
Functional.compose = function(/*fn...*/) {
    var fns = Functional.map(Function.toFunction, arguments);
    return function() {
        for (var i = fns.length; --i >= 0; )
            arguments = [fns[i].apply(this, arguments)];
        return arguments[0];
    }
}

// Same as +compose+ only applies the functions from front to back.
// :: f1 f2 f3... fn -> args -> fn(...(f3(f2(f1(*args)))))
Functional.sequence = function(/*fn...*/) {
    var fns = Functional.map(Function.toFunction, arguments);
    return function() {
        for (var i = 0; i < fns.length; i++)
            arguments = [fns[i].apply(this, arguments)];
        return arguments[0];
    }
}

// Apply +fn()+ to each elements of +sequence+.
// :: (x -> boolean) [x] -> [x]
Functional.map = function(fn, sequence, receiver) {
    arguments.length < 3 && (receiver = this);
    fn = Function.toFunction(fn);
    var len = sequence.length;
    var result = new Array(len);
    for (var i = 0; i < len; i++)
        result[i] = fn.apply(receiver, [sequence[i], i]);
    return result;
}

// Apply +fn()+ to +init+ and the first element of +sequence+,
// and then the result and the second element, and so on.
// :: (a b -> b) a [b] -> b
Functional.reduce = function(fn, init, sequence, receiver) {
    arguments.length < 4 && (receiver = this);
    fn = Function.toFunction(fn);
    var len = sequence.length;
    var result = init;
    for (var i = 0; i < len; i++)
        result = fn.apply(receiver, [result, sequence[i]]);
    return result;
}

// Return those elements of +sequence+ such that +fn()+ returns true.
// :: (x -> boolean) [x] -> [x]
Functional.select = function(fn, sequence, receiver) {
    arguments.length < 3 && (receiver = this);
    fn = Function.toFunction(fn);
    var len = sequence.length;
    var result = [];
    for (var i = 0; i < len; i++) {
        var x = sequence[i];
        fn.apply(receiver, [x, i]) && result.push(x);
    }
    return result;
}

// Is +fn()+ return true for some element of +sequence+?
// :: (x -> boolean) [x] -> [x]
Functional.some = function(fn, sequence, receiver) {
    arguments.length < 3 && (receiver = this);
    fn = Function.toFunction(fn);
    var len = sequence.length;
    var result = [];
    for (var i = 0; i < len; i++)
        if (fn.apply(receiver, [sequence[i]]))
            return true;
    return false;
}

// Is +fn()+ return true for every element of +sequence+?
// :: (x -> boolean) [x] -> [x]
Functional.every = function(fn, sequence, receiver) {
    arguments.length < 3 && (receiver = this);
    fn = Function.toFunction(fn);
    var len = sequence.length;
    var result = [];
    for (var i = 0; i < len; i++)
        if (!fn.apply(receiver, [sequence[i]]))
            return false;
    return true;
}

// Returns true when +fn()+ returns false.
// :: (x -> boolean) -> (x -> boolean)
Functional.not = function(fn) {
    fn = Function.toFunction(fn);
    return function() {  
        return !fn.apply(null, arguments);
    }
}

// Returns a function that takes an object as an argument, and applies
// +object+'s +methodName+ method to +arguments+.
// :: name args.. -> object args2... -> object[name](args... args2...)
Functional.invoke = function(methodName/*, arguments*/) {
    var args = [].slice.call(arguments, 1);
    return function(object) {
        return object[methodName].apply(object, [].slice.call(arguments, 1).concat(args));
    }
}

// Returns a function that takes an object, and returns the value of its
// +name+ property.  pluck(name) is the same as '_.name'.lambda().
// :: name -> object -> object[name]
Functional.pluck = function(name) {
    return function(object) {
        return object[name];
    }
}

// Turns an expression into a function that returns its application.
// If there is a '->', this separates the parameters from the body
//   x, y -> x + y
//   x y -> x + y
// Otherwise, if the expression contains a '_', this is the argument:
//   _ + 1
// Otherwise, each symbol is a parameter:
//   x + y
// This last case won't do what you want if the expression contains
// symbols that aren't variables.  In that case,
// use '->'
//   Math.pow(_, 2)
//
// You can chain '->' to create a function in uncurried form:
//   x -> y -> x + y
String.prototype.lambda = function() {
    var params = [];
    var body = this;
    var sections = body.split(/\s*->\s*/);
    if (sections.length > 1) {
        while (sections.length) {
            body = sections.pop();
            params = sections.pop().split(/\s*,\s*|\s+/);
            sections.length && sections.push('(function('+params+'){return ('+body+')})');
        }
    } else if (body.match(/\b_\b/)) {
        params = '_';
    } else {
        var vars = this.match(/([a-z_$][a-z_$\d]*)/gi);
        for (var i = 0, v; v = vars[i++]; )
            params.indexOf(v) >= 0 || params.push(v);
    }
    return new Function(params, 'return (' + body + ')');
}

// Make a string look like a function:
//   'x+1'.apply(null, [2]) -> 3
String.prototype.apply = function() {
    return this.lambda().apply(arguments[0], [].slice.call(arguments, 1));
}

// Make a string callable:
//   'x+1'.call(2) -> 3
String.prototype.call = function() {
    return this.lambda().apply(null, arguments);
}

// Return a Function that perfoms the action described by this
// string.  If the string contains a 'return', applies
// 'new Function' to it.  Otherwise, calls +lambda+.
String.prototype.toFunction = function() {
    var body = this;
    if (body.match(/\breturn\b/))
        return new Function(this);
    return this.lambda();
}

// Coerces +fn+ into a function if it is not already one,
// by calling its +toFunction+ method.
Function.toFunction = function(fn) {
    return typeof fn == 'function' ? fn : fn.toFunction();
}
