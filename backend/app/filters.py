from datetime import datetime

from app.models import FilterCondition, FilterGroup, FilterNode, Movie


def _eval_condition(cond: FilterCondition, movie: Movie) -> bool:
    if cond.field == "tags":
        has_tag = cond.value.lower() in (t.lower() for t in movie.tags)
        return has_tag if cond.op == "include" else not has_tag

    if cond.field == "officialRating":
        matches = (movie.official_rating or "") == cond.value
        return matches if cond.op == "include" else not matches

    if cond.field == "dateCreated":
        if movie.date_created is None:
            return False
        try:
            ref = datetime.fromisoformat(cond.value)
        except ValueError:
            return False
        movie_date = movie.date_created
        if cond.op == "before":
            return movie_date < ref
        if cond.op == "after":
            return movie_date > ref
        if cond.op == "on":
            return movie_date.date() == ref.date()

    return False


def evaluate(node: FilterNode, movie: Movie) -> bool:
    if isinstance(node, FilterGroup):
        results = (evaluate(child, movie) for child in node.children)
        return all(results) if node.operator == "AND" else any(results)
    return _eval_condition(node, movie)


def apply_filter(node: FilterNode | None, movies: list[Movie]) -> list[Movie]:
    if node is None:
        return movies
    return [m for m in movies if evaluate(node, m)]
