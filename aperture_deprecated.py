import operator
from math import ceil
from math import pi
from math import sin
from math import cos
from math import acos
from math import asin
from math import sqrt
from math import isnan
import functools

# Bezier fitting
from numpy import array, linalg, linspace, matrix

def plus(a, b):
	return tuple(map(operator.add, a, b))

def subtract(a, b):
	return tuple(map(operator.sub, a, b))

def length(a):
	return sqrt(sum([val ** 2 for val in a]))

def distance(a, b):
	return length(subtract(a,b))

def divide(a, b):
	return tuple(map(operator.div, a, b))

def multiply(a, b):
	return tuple(map(operator.mul, a, b))

def scalar_multiply(c, a):
	return tuple(c*x for x in a)

def unit(a):
	return scalar_multiply(1.0/length(a), a)

def dot(a, b):
	return sum([a_val * b_val for a_val, b_val in zip(a,b)])

def inner_product(a, b):
	return acos(dot(a,b) / (length(a) * length(b)))

def inner_product_corner(a, b, c): # a->b and a->c are lines.
	return inner_product(subtract(b,a), subtract(c,a))

def vector_to_radians(a):
	return inner_product_corner((0,0), a, (1,0))

def rotateAroundOrigin(point_to_rotate, radians):
	return (
		point_to_rotate[0] * cos(radians) - point_to_rotate[1] * sin(radians),\
		point_to_rotate[1] * cos(radians) + point_to_rotate[0] * sin(radians))

def rotateAroundPoint(point_to_rotate, pivot_point, radians):
	return plus(\
		pivot_point,
		rotateAroundOrigin(subtract(point_to_rotate, pivot_point), radians))

def flatten(l):
	return [item for sublist in l for item in sublist]

def point_on_circle(radius, center, radians):
	return plus(center, rotateAroundOrigin((radius, 0), radians))

def distance_to_circle(point, radius, circle_center):
	return distance(point, circle_center) - radius

def circle_circle_intersect(radius_a, center_a, radius_b, center_b):
	delta = distance(center_b, center_a)
	if delta == 0 or delta > radius_a + radius_b or delta < abs(radius_a - radius_b):
		raise ValueError("No intersection (r: %s, c: %s) (r: %s, c: %s)" % (radius_a, center_a, radius_b, center_b))
	a = (radius_a ** 2 - radius_b ** 2 + delta ** 2) / (2 * delta)
	h = sqrt(radius_a ** 2 - a ** 2)
	unit_delta = unit(subtract(center_b, center_a))
	closest_point = plus(center_a, scalar_multiply(a, unit_delta))
	if h == 0:
		return [closest_point]
	inverted_unit_delta = (unit_delta[1], unit_delta[0])
	return [\
		(plus(closest_point, (scalar_multiply(h, multiply(inverted_unit_delta, (1, -1)))))),
		(plus(closest_point, (scalar_multiply(h, multiply(inverted_unit_delta, (-1, 1))))))]

def bezier_interpolate_axis(t, bezier_axis):
	n = len(bezier_axis)
	if n == 4:
		return bezier_interpolate_cubic_axis(t, bezier_axis)
	elif n == 3:
		return bezier_interpolate_quadratic_axis(t, bezier_axis)
	else:
		raise ValueError("Only bezier and cubics supports: %s" % (bezier_axis))

def bezier_interpolate_quadratic_axis(t, bezier_axis):
	t2 = t ** 2
	mt = 1-t
	mt2 = mt ** 2
	return bezier_axis[0] * mt2 + bezier_axis[1] * 2*mt*t + bezier_axis[2] * t2

def bezier_interpolate_cubic_axis(t, bezier_axis):
	t2 = t * t
	t3 = t2 * t
	mt = 1-t
	mt2 = mt * mt
	mt3 = mt2 * mt
	return bezier_axis[0]*mt3 + 3*bezier_axis[1]*mt2*t + 3*bezier_axis[2]*mt*t2 + bezier_axis[3]*t3

def bezier_axis_derivative(bezier_axis):
	last_value = None
	derivative = []
	scalar_weight = len(bezier_axis) - 1
	for w in bezier_axis:
		if last_value != None:
			derivative += [scalar_weight * (w - last_value)]
		last_value = w
	return derivative

def bezier_for_each_axis(bezier, per_axis_function):
	return [per_axis_function([p[axis] for p in bezier]) for axis in range(0, len(bezier[0]))]

def bezier_apply_on_axis(bezier, per_axis_function):
	axis_weights = bezier_for_each_axis(bezier, per_axis_function)
	return array([array([axis[idx] for axis in axis_weights]) for idx in range(0, len(axis_weights[0]))])

def bezier_derivative(bezier):
	return bezier_apply_on_axis(bezier, bezier_axis_derivative)

def bezier_line_intersect(bezier, m, offset=(0,0)):
	if len(m) != 2 or len(bezier[0]) != 2:
		raise ValueError("currently only works with 2d, but %s :: %s" % (bezier, m))
	if not 3 <= len(bezier) <= 4:
		raise ValueError("currently only supports quadratic and cubic beziers; %s" % (bezier))
	radians = inner_product_corner((0,)*len(m), m, (1,) + (0,) * (len(m)-1))
	rotated_bezier = [array(rotateAroundOrigin(subtract(p, offset), -radians)) for p in bezier]
	if len(rotated_bezier) == 3:
		return get_quadratic_roots_single_axis([p[0] for p in rotated_bezier])
	elif len(bezier) == 4:
		return get_cubic_roots_single_axis([p[0] for p in rotated_bezier])
	else:
		raise ValueError("found unacceptable bezier: %s" % (rotated_bezier))

def cubic_derivative(p0, p1, p2, p3):
	p0 = array(p0)
	p1 = array(p1)
	p2 = array(p2)
	p3 = array(p3)
	a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3)
	b = 6 * (p0 - 2 * p1 + p2)
	c = 3 * (p1 - p0)
	return [a,b,c]

def quadratic_derivative(a, b, c):
	return [2*a, b]

def quadratic_roots(a, b, c):
	inner_component = (b ** 2 - 4 * a * c)
	if inner_component > 0:
		inner_component = sqrt(inner_component)
		raw_values = [(-b + inner_component) / (2 * a), (-b - inner_component) / (2 * a)]
		return [r for r in raw_values if 0 < r < 1]
	else:
		return []

def linear_root(a, b):
	if a == 0:
		return []
	root = -b / a
	if isnan(root):
		return []
	else:
		return [root]

def bezier_cubic_extreme_ts(p0, p1, p2, p3):
	a, b, c = cubic_derivative(p0, p1, p2, p3)
	al, bl = quadratic_derivative(a, b, c)
	return quadratic_roots(a[0], b[0], c[0])\
		+ quadratic_roots(a[1], b[1], c[1])\
		+ linear_root(al[0], bl[0])\
		+ linear_root(al[1], bl[1])

# A real-cuberoots-only function:
def cuberoot(v):
	return -((-v) ** (1/3.0)) if v < 0 else v ** (1/3.0)

def bezier_quadratic_roots(bezier):
	return bezier_for_each_axis(bezier, lambda axis: get_quadratic_roots_single_axis(axis))

def get_quadratic_roots_single_axis(axis):
	if len(axis) != 3:
		raise ValueError("quadratic roots require 3 components; %s" % (axis))
	a = axis[0] - 2 * axis[1] + axis[2]
	b = 2 * (axis[1] - axis[0])
	c = axis[0]
	return [r for r in quadratic_roots(a, b, c) if 0 <= r <= 1]

def bezier_cubic_roots(bezier):
	return bezier_for_each_axis(bezier, lambda axis: get_cubic_roots_single_axis(axis))

def get_cubic_roots_single_axis(axis):
	if len(axis) != 4:
		raise ValueError("cubic roots require 4 components; %s" % (axis))
	return [r for r in get_cubic_roots_raw(axis[0], axis[1], axis[2], axis[3]) if 0 <= r <= 1]

def get_cubic_roots_single_axis_raw(pa, pb, pc, pd):
	d = (-pa + 3*pb - 3*pc + pd)
	# If d is zero, just get close...
	d = d if d != 0 else 0.000000001
	a = (3*pa - 6*pb + 3*pc) / d
	b = (-3*pa + 3*pb) / d
	c = pa / d
	#
	p = (3*b - a ** 2)/3
	p3 = p/3
	q = (2 * a ** 3 - 9*a*b + 27*c)/27
	q2 = q/2
	discriminant = q2 ** 2 + p3 ** 3
	# three possible real roots:
	if discriminant < 0:
		mp3 = -p/3
		mp33 = mp3 ** 3
		r = sqrt( mp33 )
		t = -q / (2*r)
		cosphi = max(min(t, 1), -1)
		phi = acos(cosphi)
		crtr = cuberoot(r)
		t1 = 2*crtr
		root1 = t1 * cos(phi/3) - a/3
		root2 = t1 * cos((phi+2*pi)/3) - a/3
		root3 = t1 * cos((phi+4*pi)/3) - a/3
		return [root1, root2, root3]
	# three real roots, but two of them are equal:
	if discriminant == 0:
		u1 = cuberoot(-q2) if q2 < 0 else -cuberoot(q2)
		root1 = 2*u1 - a/3
		root2 = -u1 - a/3
		return [root1, root2]
	#one real root, two complex roots
	sd = sqrt(discriminant)
	u1 = cuberoot(sd - q2)
	v1 = cuberoot(sd + q2)
	root1 = u1 - v1 - a/3
	return [root1]

def bezier_quadratic_extreme_ts(a, b, c):
	al, bl = quadratic_derivative(a, b, c)
	return flatten([linear_root(al[idx], bl[idx]) for idx in range(0, len(al))])

def bezier_bounding_box(p0, p1, p2, p3):
	roots = [t for t in bezier_cubic_extreme_ts(p0, p1, p2, p3) if 0 <= t <= 1] + [0, 1]
	xs = [bezier_interpolate_axis(t, [p0[0], p1[0], p2[0], p3[0]]) for t in roots]
	ys = [bezier_interpolate_axis(t, [p0[1], p1[1], p2[1], p3[1]]) for t in roots]
	return [(min(xs), min(ys)), (max(xs), max(ys))]

def bezier_split(bezier, t):
	left, right = bezier_split_internal(bezier, t)
	return [left[::-1], right]

def bezier_split_internal(bezier, t):
	if len(bezier) == 1:
		return [[bezier[0]], [bezier[0]]]
	else:
		left, right = bezier_split_internal([((1-t) * bezier[i] + t * bezier[i + 1]) for i in range(0, len(bezier)-1)], t)
		return [left + [bezier[0]], right + [bezier[-1]]]

def box_intersection(box0, box1):
	return box0[1][0] >= box1[0][0]\
		and box1[1][0] > box0[0][0]\
		and box0[1][1] >= box1[0][1]\
		and box1[1][1] > box0[0][1]

def bounding_box_area(box):
	return (box[1][0] - box[0][0]) * (box[1][1] - box[0][1])

def bezier_intersection(b0, b1, min_size=0.00000001, t0=(0,1), t1=(0,1)):
	b0 = array(b0)
	b1 = array(b1)
	box0 = bezier_bounding_box(b0[0], b0[1], b0[2], b0[3])
	box1 = bezier_bounding_box(b1[0], b1[1], b1[2], b1[3])
	middle = ((t0[1] + t0[0])/2.0, (t1[1] + t1[0])/2.0)
	if box_intersection(box0, box1):
		if bounding_box_area(box0) + bounding_box_area(box1) <= min_size:
			return [(middle[0], middle[1])]
		else:
			left0, right0 = bezier_split(b0, 0.5)
			left1, right1 = bezier_split(b1, 0.5)
			return list(set(bezier_intersection(left0, left1, t0=(t0[0], middle[0]), t1=(t1[0], middle[1]))\
				+ bezier_intersection(left0, right1, t0=(t0[0], middle[0]), t1=(middle[1], t1[1]))\
				+ bezier_intersection(right0, left1, t0=(middle[0], t0[1]), t1=(t1[0], middle[1]))\
				+ bezier_intersection(right0, right1, t0=(middle[0], t0[1]), t1=(middle[1], t1[1]))))
	else:
		return []

def bezier_interpolate(t, bezier):
	return bezier_for_each_axis(bezier, lambda axis: bezier_interpolate_axis(t, axis))

def choose(n, k):
	"""
	A fast way to calculate binomial coefficients by Andrew Dalke (contrib).
	"""
	if 0 <= k <= n:
		ntok = 1
		ktok = 1
		for t in range(1, min(k, n - k) + 1):
			ntok *= n
			ktok *= t
			n -= 1
		return ntok // ktok
	else:
		return 0

Mtk = lambda n, t, k: t**(k)*(1-t)**(n-k)*choose(n,k)
bezierM = lambda ts: matrix([[Mtk(3,t,k) for k in range(4)] for t in ts])
def lsqfit(points,M):
	M_ = linalg.pinv(M)
	return M_ * points

def linear_curve(fun, start_value, end_value, n_samples):
	return [fun(v) for v in linspace(start_value, end_value, num=n_samples)]

def approximate_curve_single(values, ts):
	return lsqfit(values, bezierM(ts)).tolist()

def curve_error(bezier, values, ts):
	return max([length(subtract(v_t[0], bezier_interpolate(v_t[1], bezier))) for v_t in zip(values, ts)])

def approximate_curve(fun, start_value, end_value, n_samples, acceptable_error=0.001):
	values = linear_curve(fun, start_value, end_value, n_samples)
	ts = array(range(n_samples), dtype='float')/(n_samples - 1)
	curve = approximate_curve_single(values, ts)
	error = curve_error(curve, values, ts)
	if error <= acceptable_error:
		return [curve]
	else:
		midpoint = (end_value + start_value) / 2.0
		c1 = approximate_curve(fun, start_value, midpoint, n_samples, acceptable_error)
		c2 = approximate_curve(fun, midpoint, end_value, n_samples, acceptable_error)
		return c1 + c2

# Domain specific functions
def rotation_at_distance(percent_along, part_radians):
	if not 0 <= percent_along <= 1:
		raise ValueError("0 < percent_along < 1 but %s" % (percent_along))
	if percent_along == 0:
		return 0
	if percent_along == 1:
		return 2 * rotation_at_distance(0.5, part_radians)
	origin = (0,0)
	center_a = point_on_circle(1-percent_along, origin, 0)
	center_b = point_on_circle(1-percent_along, origin, part_radians)
	intersection = [p for p in circle_circle_intersect(\
		1,\
		center_a,\
		1,\
		center_b) if length(p) <= 1]
	if len(intersection) != 1:
		raise ValueError("unexpected intersections at %s: %s; %s %s" % (percent_along, intersection, center_a, center_b))
	return inner_product_corner(\
		center_a,\
		intersection[0],\
		point_on_circle(1, center_a, pi))

def translate_point_at_distance(point, percent_along, part_radians, idx):
	return plus(\
		point_on_circle(-percent_along, (0,0), idx * -part_radians),\
		rotateAroundPoint(\
			point,\
			point_on_circle(1, (0,0), idx * -part_radians),\
			-rotation_at_distance(percent_along, part_radians)))

def unit_outer_circle_center_at_distance(percent_along, part_radians, idx, offset_radians=0):
	return translate_point_at_distance(\
		point_on_circle(1, (0,0), (idx + 1) * (-part_radians) + offset_radians), percent_along, part_radians, idx)

def outer_radian_length_at_distance(percent_along, part_radians, offset_radians):
	if not 0 <= percent_along <= 1:
		raise ValueError("0 < percent_along < 1 but %s" % (percent_along))
	if percent_along == 0:
		percent_along += 0.00000001 # approximate to avoid complexity
	outer_center = unit_outer_circle_center_at_distance(percent_along, part_radians, 0, offset_radians)
	inner_center = point_on_circle(1-percent_along, (0,0), 0)
	all_intersections = circle_circle_intersect(1, (0,0), 1, outer_center)
	intersection = [p for p in all_intersections if length(subtract(p, inner_center)) > 1]
	if len(intersection) != 1:
		raise ValueError("unexpected intersections at %s/%s: %s of %s; %s %s" % (percent_along, -offset_radians / part_radians, intersection, all_intersections, outer_center, inner_center))
	return (plus(\
			rotateAroundPoint(\
				intersection[0],\
				point_on_circle(1 - percent_along, (0,0), 0),\
				rotation_at_distance(percent_along, part_radians)),\
			point_on_circle(percent_along, (0,0), 0)),\
		inner_product_corner(outer_center, translate_point_at_distance((0,0), percent_along, part_radians, 0), intersection[0]))

def inner_radian_length_and_offset_at_distance(percent_along, part_radians):
	if not 0 <= percent_along <= 1:
		raise ValueError("0 < percent_along < 1 but %s" % (percent_along))
	if percent_along == 0:
		percent_along += 0.00000001 # approximate to avoid complexity
	if percent_along == 1:
		percent_along -= 0.00000001 # approximate to avoid complexity
	covering_center = unit_outer_circle_center_at_distance(percent_along, part_radians, -1)
	covering_inner_center = point_on_circle(1-percent_along, (0,0), part_radians)
	all_intersections = circle_circle_intersect(1, (0,0), 1, covering_center)
	intersection = [p for p in all_intersections if length(subtract(p, covering_inner_center)) > 1]
	if len(intersection) != 1:
		raise ValueError("unexpected intersections at %s: %s of %s; %s %s" % (percent_along, intersection, all_intersections, covering_center, (0,0)))
	flat_point = plus(\
		rotateAroundPoint(\
			intersection[0],\
			point_on_circle(1 - percent_along, (0,0), 0),\
			rotation_at_distance(percent_along, part_radians)),\
		point_on_circle(percent_along, (0,0), 0))
	return flat_point\
		+ (0,)

def outer_radian_length_and_offset_at_distance(t, part_radians):
	if t == 1:
		t = 0.999999
	if not 0 <= t < 1:
		raise ValueError("0 <= percent_along < 1 but %s" % (t))
	flat_point = outer_radian_max_point(part_radians, t * part_radians)[0]
	return flat_point + (0,)

def high_point(func, value_transformer, guess, min_input, max_input, epsilon):
	raw_value = func(guess)
	if guess - min_input < epsilon or max_input - guess < epsilon:
		return (guess, raw_value)
	prev_value = value_transformer(func(guess - epsilon)) 
	value = value_transformer(raw_value)
	next_value = value_transformer(func(guess + epsilon))
	if value > prev_value and value > next_value:
		return (guess, raw_value)
	elif prev_value < value < next_value:
		return high_point(func, value_transformer, (guess + max_input) / 2.0, guess, max_input, epsilon)
	else:
		return high_point(func, value_transformer, (guess + min_input) / 2.0, min_input, guess, epsilon)

def outer_radian_max_point(part_radians, offset_radians):
	fun = functools.partial(\
		outer_radian_length_at_distance,\
		part_radians=part_radians,\
		offset_radians=offset_radians)
	return high_point(fun, lambda x: x[1], 0.5, 0, 1, 0.0000001)[1]

def unit_arc_bezier_at_origin(radian_sweep):
	p0 = (cos(radian_sweep/2.0), sin(radian_sweep/2.0))
	p1 = ((4.0-p0[0])/3.0, (1.0 - p0[0]) * (3.0 - p0[0]) / (3.0 * p0[1]))
	return [p0, p1, (p1[0], -p1[1]), (p0[0], -p0[1])]

def unit_part_width_at_radian_offset(part_radians, offset_radians):
	theta = (pi - part_radians)/2.0 - offset_radians
	d = sqrt((1 - cos(part_radians)) ** 2 + sin(part_radians ) ** 2)
	return d * cos(theta) + sqrt(1 - (d * sin(theta)) ** 2) - 1

def unit_distance_at_position(part_radians, unit_point):
	radians_to_point = inner_product_corner((1,0), (0,0), unit_point)
	part_width = unit_part_width_at_radian_offset(part_radians, radians_to_point)
	return 1 + part_width - length(subtract(unit_point, (1,0)))

def unit_inner_circle_point(t, part_radians):
	circle_theta = (4.0 - t) * pi / 3.0
	return [cos(circle_theta) + 1,\
		sin(circle_theta),\
		unit_part_width_at_radian_offset(part_radians, (1-t) * pi/3)]

def unit_outer_circle_point(t, part_radians):
	c = point_on_circle(1, (0,0), -part_radians)
	circle_theta = pi + t * (outer_radian_max_point(part_radians, 0))[1] - part_radians
	return [cos(circle_theta) + c[0],\
		sin(circle_theta) + c[1],\
		0]

def unit_z_scale(part_radians, part_clearance, bezier_list):
	edge_point = bezier_low_point(bezier_list)
	other_edge_point = rotateAroundPoint(edge_point, (1,0), -part_radians)
	return part_clearance/\
		(unit_distance_at_position(part_radians, edge_point)\
			- unit_distance_at_position(part_radians, other_edge_point))

def circle_bezier(center, radius, radian_start, radian_stop):
	radian_range = radian_start - radian_stop
	arc = unit_arc_bezier_at_origin(radian_range)
	# scale
	arc = [scalar_multiply(radius, p) for p in arc]
	# rotate
	arc = [rotateAroundOrigin(p, radian_start - radian_range / 2.0) for p in arc]
	# translate
	arc = [plus(center, p) for p in arc]
	return arc

def unit_to_final_function(center, radius, z_scale, p):
	p = plus(scalar_multiply(radius, p), center + (0,))
	return (p[0], p[1], p[2] * z_scale)

def bezier_low_point(bezier_list):
	high_point = None
	for b in bezier_list:
		for t in ([t for t in bezier_cubic_extreme_ts(b[0], b[1], b[2], b[3]) if 0 <= t <= 1] + [0, 1]):
			y = bezier_interpolate_axis(t, [b[0][1], b[1][1], b[2][1], b[3][1]])
			if high_point == None or high_point[1] > y:
				high_point = (bezier_interpolate_axis(t, [b[0][0], b[1][0], b[2][0], b[3][0]]), y)
	return high_point

def bezier_bezier_list_intersection(bezier_list, intersect_bezier):
	for idx, bezier in enumerate(bezier_list):
		intersections = bezier_intersection(bezier, intersect_bezier)
		if len(intersections) >= 1:
			intersection = list(intersections)[0]
			left_split, right_split = bezier_split(array(bezier), intersection[0])
			return (bezier_list[:idx],\
				[[p.tolist() for p in left_split]],\
				[[p.tolist() for p in right_split]],\
				bezier_list[(idx+1):])
	raise ValueError("Could not find intersections for %s with %s" % (bezier_list, intersect_bezier))

def build_unit_part_top(radian_width):
	outer_top = approximate_curve(functools.partial(outer_radian_length_and_offset_at_distance, part_radians=radian_width), 0, 0.999, 10)
	inner_top = approximate_curve(functools.partial(inner_radian_length_and_offset_at_distance, part_radians=radian_width), 1, 0, 10)
	high_point = bezier_low_point(inner_top)
	intersect_bezier = [[high_point[0]+0.1, high_point[1]-1],\
		[high_point[0], high_point[1] - 0.5, ],\
		[high_point[0], high_point[1] + 0.5, ],
		[high_point[0], high_point[1] + 1, ]]
	outer_left, outer_middle, reject, reject = bezier_bezier_list_intersection(outer_top, intersect_bezier)
	reject, reject, inner_middle, inner_right = bezier_bezier_list_intersection(inner_top, intersect_bezier)
	return outer_left + outer_middle + inner_middle + inner_right

def build_part_beziers(center, radius, radian_width, part_clearance):
	unit_bezer_list =\
		approximate_curve(functools.partial(unit_inner_circle_point, part_radians=radian_width), 0, 1, 10)\
		+ approximate_curve(functools.partial(unit_outer_circle_point, part_radians=radian_width), 0, 1, 10)\
		+ build_unit_part_top(radian_width)
	return [[unit_to_final_function(center, radius, 0, p) for p in b] for b in unit_bezer_list]

def clone_part_rotated_around_point(part, radians, pivot_point):
	new_part = []
	for bezier in part:
		new_part.append([rotateAroundPoint(p, pivot_point, radians) + (p[2],) for p in bezier])
	return new_part

# Rendering specific -- SVG
def svg_part(part, display_modifier=lambda p:p, options=""):
	node = "<path d=\"M%s %s " % display_modifier(part[0][0])
	for bezier in part:
		bezier = [display_modifier(p) for p in bezier]
		node += "C%s %s, %s %s, %s %s " % (bezier[1] + bezier[2] + bezier[3])
	node += "\" %s/>" % (options)
	return node

def svg_beziers(beziers, display_modifier=lambda p:p, options=""):
	node = "<path d=\""
	for bezier in beziers:
		print(bezier)
		bezier = [(m[0], m[1]) for m in [display_modifier(p) for p in bezier]]
		node += "M%s %s C%s %s, %s %s, %s %s " % (bezier[0] + bezier[1] + bezier[2] + bezier[3])
	node += "\" %s/>" % (options)
	return node

def build_svg_beziers(offset=0, part_radians=pi/8, part_thickness=0.02, minimum_clearance=0.01):
	return svg_beziers(\
		build_part_beziers((250 + offset, 250), 100, part_radians, part_thickness + minimum_clearance),\
		display_modifier=lambda p:[round(x,2) for x in p],\
		options="fill=\"None\" stroke=\"red\"")

def svg_linear(points, display_modifier=lambda p:p, options=""):
	points = [display_modifier(p) for p in points]
	node = "<path d=\"M%s %s" % points[0]
	for point in points:
		node += "L%s %s " % point
	node += "\" %s/>" % (options)
	return node

import bmesh

def blender_combine_meshes(mesh_name, object_name, objects):
	bm = bmesh.new()
	for o in objects:
		bm.from_mesh(o.data) 
	mesh = bpy.data.meshes.new( mesh_name )
	bm.to_mesh( mesh )
	obj = bpy.data.objects.new( object_name, mesh )
	obj.matrix_world = objects[0].matrix_world
	obj.location = objects[0].location
	bpy.context.scene.objects.link(obj)
	context = bpy.context
	scene = context.scene
	for o in objects:
		scene.objects.unlink(o)
	return obj

# Rendering specific -- Blender
def build_blender_parts(radius, center, n_parts, part_thickness=0.05, minimum_clearance=0.02):
	part_radians = pi / (n_parts / 2.0)
	clearance = part_thickness + minimum_clearance
	center_offset = (0, 0, (part_thickness + minimum_clearance) / 2.0)
	template_top = build_part_beziers(center, radius, part_radians, clearance)
	template_top = [[plus(p, center_offset) for p in l] for l in template_top]
	template_bottom = [[(p[0], p[1], -p[2]) for p in l] for l in template_top]
	template_origin = (radius, 0)
	# update this to be the LCD of 6 and n_parts
	parts = []
	for i in range(0, n_parts):
		parts.append(blender_combine_meshes("part_mesh_%s", "part_object_%s",\
			[bezier_to_mesh(blender_bezier(\
				"part_%s" % (i),
				"curve_%s" % (i),
				clone_part_rotated_around_point(\
					template_top if i%2 == 0 else template_bottom,\
					i * part_radians,\
					center),
				rotateAroundPoint(template_origin, center, i * part_radians) + (0,)),part_thickness)]))
	return parts

def to_mesh(obj):
	context = bpy.context
	scene = context.scene
	mesh = obj.to_mesh(scene, False, 'RENDER')
	o = bpy.data.objects.new(obj.name, mesh)
	scene.objects.link(o)
	o.matrix_world = obj.matrix_world
	o.location = obj.location
	scene.objects.unlink(obj)
	bpy.context.scene.objects.active = o
	return o

def bezier_to_mesh(obj, depth):
	mesh = to_mesh(obj)
	bpy.ops.object.mode_set(mode='EDIT')
	bpy.ops.mesh.select_mode( type	= 'EDGE'	 )
	bpy.ops.mesh.select_all( action = 'SELECT' )
	bpy.ops.mesh.fill(True)
	bpy.ops.mesh.select_mode( type	= 'FACE'	 )
	bpy.ops.mesh.select_all( action = 'SELECT' )
	bpy.ops.mesh.extrude_region_move(
			TRANSFORM_OT_translate={"value":(0, 0, depth)}
	)
	bpy.ops.object.mode_set(mode='OBJECT')
	return mesh

def build_and_animate_parts(radius, center, n_parts):
	return animate_parts(build_blender_parts(radius, center, n_parts), center, n_parts)

def animate_parts(parts, center, n_parts):
	total_rotation = -2 * rotation_at_distance(0.5, pi / (n_parts / 2.0))
	return [animate_part(p, center, total_rotation) for p in parts]

def animate_part(part, center, total_rotation):
	part.keyframe_insert(data_path='rotation_euler', frame=1)
	part.keyframe_insert(data_path='location', frame=1)
	part.rotation_euler = (0, 0, total_rotation)
	part.location = center + (0,)
	part.keyframe_insert(data_path='rotation_euler', frame=120)
	part.keyframe_insert(data_path='location', frame=120)
	for fcurve in part.animation_data.action.fcurves:
		for kf in fcurve.keyframe_points:
			kf.interpolation = 'LINEAR'
	return part

def blender_bezier(objname, curvename, cList, origin=(0,0,0)):
	curvedata = bpy.data.curves.new(name=curvename, type='CURVE')
	curvedata.dimensions = '3D'
	objectdata = bpy.data.objects.new(objname, curvedata)
	objectdata.location = origin
	bpy.context.scene.objects.link(objectdata)
	polyline = curvedata.splines.new('BEZIER')
	n_points = len(cList)
	polyline.bezier_points.add(n_points-1)
	for idx_1, (c1, h1, h2, c2) in enumerate(cList):
		idx_2 = (idx_1 + 1) % n_points
		point_1 = polyline.bezier_points[idx_1]
		point_1.co = subtract(c1, origin)
		point_1.handle_right = subtract(h1, origin)
		point_1.handle_right_type = 'FREE'
		point_2 = polyline.bezier_points[idx_2]
		point_2.co = subtract(c2, origin)
		point_2.handle_left = subtract(h2, origin)
		point_2.handle_left_type = 'FREE'
	polyline.use_cyclic_u = True
	return objectdata

def transform_part_point_arount_part_0(t, point, part_idx, part_radians):
	world_coordinates = translate_point_at_distance(point, t, part_radians, part_idx)
	return plus(\
		rotateAroundPoint(\
			world_coordinates,\
			point_on_circle(1 - t, (0,0), 0),\
			rotation_at_distance(t, part_radians)),\
		point_on_circle(t, (0,0), 0))

def transform_from_part_0_to_part_x(point, idx, part_radians):
	return rotateAroundPoint((point[0], point[1]), (0,0), idx * -part_radians)

def poly_t(n_beziers, idx, t):
	per_bezier = 1.0/n_beziers
	return (idx + t) * per_bezier

def find_derivative_slope_intersections(poly_bezier, m, b=(0,0)):
	n_beziers = len(poly_bezier)
	intersections = []
	goal = vector_to_radians(m)
	last_max_value = vector_to_radians(bezier_interpolate(1, poly_bezier[-1]))
	for idx, bezier in enumerate(poly_bezier):
		min_value = vector_to_radians(bezier_interpolate(0, bezier))
		if last_max_value < goal < min_value or min_value < goal < last_max_value:
			intersections.append(poly_t(n_beziers, idx, 0))
		intersections += [poly_t(n_beziers, idx, t) for t in bezier_line_intersect(bezier, m, b) if dot(bezier_interpolate(t, bezier),m) >= 0]
		last_max_value = vector_to_radians(bezier_interpolate(1, bezier))
	return intersections

def poly_bezier_interpolate(t, poly_bezier):
	if len(poly_bezier) == 0:
		raise ValueError("trying to interpolate empty bezier %s" % (poly_bezier))
	n_beziers = len(poly_bezier)
	idx = min(int(t * n_beziers), n_beziers - 1)
	return bezier_interpolate(t - idx * (1.0/n_beziers), poly_bezier[idx])

def build_planar_sweep(t, poly_bezier, movement_fn, movement_poly_bezier_derivative):
	adjusted_poly_bezier = [[movement_fn(t, p) for p in b] for b in poly_bezier]
	adjusted_poly_bezier_derivative = [bezier_derivative(b) for b in adjusted_poly_bezier]
	direction_of_movement = poly_bezier_interpolate(t, movement_poly_bezier_derivative)
	intersections = find_derivative_slope_intersections(\
		adjusted_poly_bezier_derivative, direction_of_movement)
	if len(intersections) != 1:
		print("WARNING!!! More than one intersection not implemented yet: %s" % (intersections))
	p = poly_bezier_interpolate(intersections[-1], adjusted_poly_bezier)
	return p

def test3(part_beziers, idx=2, part_radians=pi/8):
	split_beziers = []
	unsplit_beziers = [] + part_beziers
	while len(unsplit_beziers) > 0:
		b = [(p[0], p[1]) for p in unsplit_beziers.pop()]
		ts = [t for t in bezier_cubic_extreme_ts(b[0], b[1], b[2], b[3]) if 0 < t < 1]
		if len(ts) == 0:
			split_beziers.append(b)
		else:
			left, right = bezier_split(array(b), ts[0])
			unsplit_beziers += [left, right]
	move_fn = lambda t, p: transform_part_point_arount_part_0(\
		t,\
		transform_from_part_0_to_part_x(p, idx, part_radians),\
		idx,\
		part_radians)
	result = []
	for b in split_beziers:
		result.append([[move_fn(0, p) for p in b]])
		result.append([[move_fn(1, p) for p in b]])
		result += [approximate_curve(functools.partial(move_fn, p=b[0]), 0, 1, 10)]
		result += [approximate_curve(functools.partial(move_fn, p=b[-1]), 1, 0, 10)]
	s = svg_part(part_beziers, lambda p:plus(scalar_multiply(100, (p[0],p[1])), (250,250)), "stroke=\"none\" fill=\"blue\"")
	for l in result:
		s += svg_beziers(l, lambda p:plus(scalar_multiply(100, (p[0],p[1])), (250,250)), "stroke=\"none\" fill=\"green\"")
	return s


def test(part_beziers, idx=2, part_radians=pi/8):
	move_fn = lambda t, p: transform_part_point_arount_part_0(\
		t,\
		transform_from_part_0_to_part_x(p, idx, part_radians),\
		idx,\
		part_radians)
	movement_bezier = approximate_curve(functools.partial(move_fn, p=(0,0)), 1, 0, 10)
	movement_derivative = [bezier_derivative(b) for b in movement_bezier]
	return svg_beziers(\
		approximate_curve(\
			functools.partial(\
				build_planar_sweep,\
				poly_bezier=part_beziers,\
				movement_fn=move_fn,\
				movement_poly_bezier_derivative=movement_derivative),\
			1, 0, 10),\
		lambda p:plus(scalar_multiply(100, (p[0],p[1])), (250,250)), "stroke=\"green\" fill=\"none\"")

def test2(part_beziers, idx=2, part_radians=pi/8):
	for t in linspace(0, 1, num=10):
		for b in part_beziers:
			transformer = lambda p:plus(scalar_multiply(100, (p[0],p[1])), (250,250))
			p1 = transform_from_part_0_to_part_x(bezier_interpolate(t, b), idx, part_radians)
			print("<circle cx=\"%s\" cy=\"%s\" r=\"2\"/>" % transformer(p1))
			print(\
				svg_beziers(\
					approximate_curve(\
						functools.partial(transform_part_point_arount_part_0,\
							point=p1,\
							part_idx=idx,
							part_radians=part_radians),
						1, 0, 10), transformer, "stroke=\"green\" fill=\"none\""))

#part = build_part_beziers((0,0), 1, pi/8, 0.01)
test3(part, 2, pi/8)



#build_part_beziers((0,0), 1, pi/8)
build_and_animate_parts(1, (0,0), 16)
#build_svg_beziers(offset=-75, part_radians=pi/9)
